using System.Diagnostics;
using System.Text.Json.Serialization;
using SharedDomainTypes;

namespace Emulator;

/// <summary>
/// Snapshot of the machine sent to the frontend after a step or a run. While the program runs in the
/// background, Running is true and Speed is how fast it's really going (1 = real time).
/// </summary>
public record EmulatorState(
    int Pc,
    int Index,
    long Cycles,
    [property: JsonConverter(typeof(ByteArrayAsNumbersConverter))] byte[] DataSpace,
    string? Error,
    bool Running = false,
    double? Speed = null);

/// <summary>Input pin levels from the breadboard, as PINB/PINC/PIND bit masks.</summary>
public record PinInputs(byte B, byte C, byte D);

/// <summary>
/// A loaded program running on one emulated ATmega328P at 16 MHz. Keeps the machine between requests.
/// Start() runs the program on a background thread, paced to the wall clock, while the frontend polls
/// for snapshots; Step() and Run() still work a request at a time.
/// Emulates Timer0 and its overflow interrupt, which millis() and delay() rely on.
/// </summary>
public class AvrSession
{
    public const int ClockHz = 16_000_000;

    // Timer0 registers (data addresses) and its overflow interrupt vector (word address).
    private const int TCCR0B = 0x45, TCNT0 = 0x46, TIMSK0 = 0x6E;
    private const int TIMER0_OVF_VECTOR = 0x20;

    private readonly object gate = new();
    private CommandTemplate?[] commandAtWord = [];
    private readonly Dictionary<int, int> indexAtWord = new();
    private byte[] flash = [];
    private MachineData machine = new();
    private long cycles;
    private long timer0Leftover;
    private string? error;

    // Background run (see Start). Guarded by gate, like the machine.
    private Thread? runner;
    private bool running;
    private double speedFactor = 1;
    private long lastPollTicks;
    private double measuredSpeed;

    // Cycles run per turn of the background loop before letting a poll in (about a millisecond's worth)
    private const int SliceCycles = 16_000;
    // If the computer can't keep up for this long, forget the backlog instead of racing to catch up
    private const double MaxBacklogSeconds = 0.1;
    // Stop running if the frontend stops polling (the tab was closed or lost its connection)
    private static readonly TimeSpan PollTimeout = TimeSpan.FromSeconds(3);

    public EmulatorState Load(string[] dataLines)
    {
        lock (gate)
        {
            running = false;
            var decoded = new FindInstruction().FindAllCommandTemplates(dataLines);
            flash = Convert.FromHexString(string.Concat(dataLines));
            commandAtWord = new CommandTemplate?[flash.Length / 2 + 2];
            indexAtWord.Clear();
            for (int i = 0; i < decoded.Count; i++)
            {
                int word = decoded[i].ProgramAddressByte / 2;
                if (word < commandAtWord.Length) commandAtWord[word] = decoded[i].Command;
                indexAtWord[word] = i;
            }
            ResetLocked();
            return SnapshotLocked();
        }
    }

    public EmulatorState Reset()
    {
        lock (gate)
        {
            ResetLocked();
            return SnapshotLocked();
        }
    }

    public EmulatorState Step(PinInputs? inputs)
    {
        lock (gate)
        {
            if (error == null)
            {
                ApplyInputs(inputs);
                try { ExecuteOne(); }
                catch (Exception e) { error = e.Message; }
            }
            return SnapshotLocked();
        }
    }

    /// <summary>
    /// Runs for up to the given number of clock cycles (16,000 per emulated millisecond), stopping early
    /// on an error or after maxMilliseconds of real time so a request never hangs.
    /// </summary>
    public EmulatorState Run(long cycleBudget, PinInputs? inputs, int maxMilliseconds = 250)
    {
        lock (gate)
        {
            if (error == null)
            {
                ApplyInputs(inputs);
                var clock = Stopwatch.StartNew();
                long target = cycles + cycleBudget;
                try
                {
                    int sinceCheck = 0;
                    while (cycles < target)
                    {
                        ExecuteOne();
                        if (++sinceCheck >= 20_000)
                        {
                            sinceCheck = 0;
                            if (clock.ElapsedMilliseconds >= maxMilliseconds) break;
                        }
                    }
                }
                catch (Exception e) { error = e.Message; }
            }
            return SnapshotLocked();
        }
    }

    /// <summary>
    /// Runs the program in the background at speedFactor × real time (1 = real time) until Stop(), an
    /// error, or the frontend stops polling. Calling it while running just changes the speed.
    /// </summary>
    public EmulatorState Start(double factor, PinInputs? inputs)
    {
        lock (gate)
        {
            speedFactor = Math.Clamp(factor, 0.001, 10);
            lastPollTicks = Environment.TickCount64;
            ApplyInputs(inputs);
            if (!running && error == null)
            {
                running = true;
                measuredSpeed = 0;
                runner = new Thread(RunInBackground) { IsBackground = true, Name = "AVR emulator" };
                runner.Start();
            }
            return SnapshotLocked();
        }
    }

    /// <summary>The latest snapshot while running in the background, passing in the breadboard's inputs.</summary>
    public EmulatorState Poll(PinInputs? inputs)
    {
        lock (gate)
        {
            lastPollTicks = Environment.TickCount64;
            ApplyInputs(inputs);
            return SnapshotLocked();
        }
    }

    public EmulatorState Stop()
    {
        lock (gate)
        {
            running = false;
            return SnapshotLocked();
        }
    }

    // Keeps the emulated clock in step with the real one: each turn works out how many cycles should have
    // run by now and runs a slice towards that, sleeping briefly whenever it's caught up.
    private void RunInBackground()
    {
        var clock = Stopwatch.StartNew();
        double startSeconds = 0, startFactor;
        long startCycles;
        long speedCycles, speedTicks = clock.ElapsedTicks;
        lock (gate)
        {
            startCycles = speedCycles = cycles;
            startFactor = speedFactor;
        }

        while (true)
        {
            bool caughtUp;
            lock (gate)
            {
                if (!running || runner != Thread.CurrentThread) return;
                if (Environment.TickCount64 - lastPollTicks > PollTimeout.TotalMilliseconds)
                {
                    running = false;
                    return;
                }

                double now = clock.Elapsed.TotalSeconds;
                // A new speed (or a reset) starts the pacing again from here
                if (speedFactor != startFactor || cycles < startCycles)
                {
                    startSeconds = now;
                    startCycles = speedCycles = cycles;
                    startFactor = speedFactor;
                    speedTicks = clock.ElapsedTicks;
                }
                long due = startCycles + (long)((now - startSeconds) * ClockHz * speedFactor);
                long backlog = (long)(MaxBacklogSeconds * ClockHz * speedFactor);
                if (due - cycles > backlog)
                {
                    // Running behind: carry on from here rather than fast-forwarding to catch up
                    startCycles = cycles - backlog;
                    startSeconds = now;
                    due = cycles;
                }

                long target = Math.Min(due, cycles + SliceCycles);
                try
                {
                    while (cycles < target) ExecuteOne();
                }
                catch (Exception e)
                {
                    error = e.Message;
                    running = false;
                    return;
                }
                caughtUp = cycles >= due;

                // How fast it's really going, averaged over about half a second
                long ticks = clock.ElapsedTicks;
                if (ticks - speedTicks > Stopwatch.Frequency / 2)
                {
                    measuredSpeed = (cycles - speedCycles) / (double)ClockHz / ((ticks - speedTicks) / (double)Stopwatch.Frequency);
                    speedCycles = cycles;
                    speedTicks = ticks;
                }
            }
            if (caughtUp) Thread.Sleep(1);
        }
    }

    private void ResetLocked()
    {
        machine = new MachineData { ProgramMemory = flash };
        cycles = 0;
        timer0Leftover = 0;
        error = null;
    }

    private void ExecuteOne()
    {
        int pc = machine.PC;
        CommandTemplate? command = pc >= 0 && pc < commandAtWord.Length ? commandAtWord[pc] : null;
        if (command == null)
            throw new InvalidOperationException($"The program counter left the program (word address 0x{pc:X4}).");

        machine.ExtraCycles = 0;
        command.RunCommand(machine);
        int spent = command.Cycles + machine.ExtraCycles;
        AdvanceTimer0(spent);
        spent += ServiceInterrupts();
        cycles += spent;
    }

    private void AdvanceTimer0(int spent)
    {
        int prescaler = (machine.DataSpace[TCCR0B] & 0x07) switch { 1 => 1, 2 => 8, 3 => 64, 4 => 256, 5 => 1024, _ => 0 };
        if (prescaler == 0) return;

        timer0Leftover += spent;
        if (timer0Leftover < prescaler) return;
        long ticks = timer0Leftover / prescaler;
        timer0Leftover %= prescaler;
        if (ticks == 0) return;

        long count = machine.DataSpace[TCNT0] + ticks;
        if (count > 0xFF) machine.DataSpace[MachineData.TIFR0] |= 0x01; // TOV0
        machine.DataSpace[TCNT0] = (byte)(count & 0xFF);
    }

    // On the real chip an interrupt pushes the return address, clears I and jumps to its vector.
    private int ServiceInterrupts()
    {
        if (!machine.GetFlag(SregBit.I)) return 0;
        bool overflowPending = (machine.DataSpace[MachineData.TIFR0] & 0x01) != 0;
        bool overflowEnabled = (machine.DataSpace[TIMSK0] & 0x01) != 0;
        if (!overflowPending || !overflowEnabled) return 0;

        machine.DataSpace[MachineData.TIFR0] &= 0xFE;
        machine.PushReturnAddress(machine.PC);
        machine.SetFlag(SregBit.I, false);
        machine.PC = TIMER0_OVF_VECTOR;
        return 4;
    }

    // Input pins read the breadboard; output pins read back what the program drives them to.
    private void ApplyInputs(PinInputs? inputs)
    {
        if (inputs == null) return;
        SetPin(MachineData.PINB, inputs.B);
        SetPin(MachineData.PINC, inputs.C);
        SetPin(MachineData.PIND, inputs.D);
    }

    private void SetPin(int pinAddress, byte inputs)
    {
        byte ddr = machine.DataSpace[pinAddress + 1];
        byte port = machine.DataSpace[pinAddress + 2];
        machine.DataSpace[pinAddress] = (byte)((port & ddr) | (inputs & ~ddr));
    }

    private EmulatorState SnapshotLocked() =>
        new(machine.PC, indexAtWord.TryGetValue(machine.PC, out int index) ? index : -1, cycles, (byte[])machine.DataSpace.Clone(), error,
            running, running && measuredSpeed > 0 ? Math.Round(measuredSpeed / speedFactor, 2) : null);
}
