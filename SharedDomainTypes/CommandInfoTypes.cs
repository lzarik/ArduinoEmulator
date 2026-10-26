using System.Text.Json;
using System.Text.Json.Serialization;

namespace SharedDomainTypes;

public class CommandInformation
{
    public string CommandName { get; set; } = string.Empty;
    public List<byte> CommandBytes { get; set; } = new();
    public int? ProgramAddressByte { get; set; }
    public int? SourceLineNumber { get; set; }
}

public class ProgramStack<T>()
{
    public Stack<T> Stack = new Stack<T>();
    public int StackPointer;
}
public class SRAM
{
    public Stack<byte> Stack = new Stack<byte>();
}

/// <summary>SREG bit positions.</summary>
public static class SregBit
{
    public const int C = 0, Z = 1, N = 2, V = 3, S = 4, H = 5, T = 6, I = 7;
}

public class MachineData
{
    // ATmega328P data space: 32 registers, 64 I/O registers, 160 extended I/O registers, 2 KB SRAM.
    public const int DataSize = 0x900;
    public const int RamEnd = DataSize - 1;
    public const int SPL = 0x5D, SPH = 0x5E, SREG_ADDR = 0x5F;
    public const int TIFR0 = 0x35, PINB = 0x23, PINC = 0x26, PIND = 0x29;

    // These are properties (not fields) so the API can read the machine state the frontend sends;
    // System.Text.Json skips fields, which made every instruction run on a blank machine.
    public CommandInformation? CommandToParse {get; set;}

    /// <summary>Program counter, in 16-bit words like the real chip.</summary>
    public int PC { get; set; }

    private byte[] dataSpace = new byte[DataSize];

    [JsonConverter(typeof(ByteArrayAsNumbersConverter))]
    public byte[] DataSpace
    {
        get => dataSpace;
        // Older callers send a shorter array; pad it so the stack at the top of RAM still fits.
        set
        {
            if (value.Length >= DataSize) { dataSpace = value; return; }
            dataSpace = new byte[DataSize];
            Array.Copy(value, dataSpace, value.Length);
        }
    }

    /// <summary>Stack pointer, kept where the chip keeps it: the SPL/SPH I/O registers.</summary>
    public int SP
    {
        get => dataSpace[SPL] | (dataSpace[SPH] << 8);
        set { dataSpace[SPL] = (byte)value; dataSpace[SPH] = (byte)(value >> 8); }
    }

    /// <summary>Status register, kept in the SREG I/O register so IN/OUT on 0x3F see the same value.</summary>
    public SREG StatusRegister
    {
        get => new SREG { SREGByte = Sreg };
        set => Sreg = value.SREGByte;
    }

    [JsonIgnore]
    public byte Sreg
    {
        get => dataSpace[SREG_ADDR];
        set => dataSpace[SREG_ADDR] = value;
    }

    /// <summary>Flash contents (byte addressed), for LPM and for sizing skipped instructions.</summary>
    [JsonIgnore]
    public byte[] ProgramMemory { get; set; } = [];

    /// <summary>Cycles an instruction takes beyond its base count (taken branches, skips). Reset per instruction.</summary>
    [JsonIgnore]
    public int ExtraCycles { get; set; }

    public MachineData()
    {
        PC = 0;
        // The stack starts at the top of RAM and grows down.
        SP = RamEnd;
    }

    public MachineData Clone()
    {
        return new MachineData
        {
            PC = PC,
            DataSpace = (byte[])DataSpace.Clone(),
            ProgramMemory = ProgramMemory,
            CommandToParse = CommandToParse
        };
    }

    public class DataChange
    {
        public int Index { get; init; }
        public byte Before { get; init; }
        public byte After { get; init; }
    }

    public class Diff
    {
        public int? PC { get; init; }
        public int? SP { get; init; }
        public byte? SREGByte { get; init; }
        public List<DataChange> DataChanges { get; init; } = new List<DataChange>();
    }

    public static Diff CalculateChanges(MachineData before, MachineData after)
    {
        if (before == null || after == null) throw new ArgumentNullException("before/after cannot be null");

        var diff = new Diff
        {
            PC = before.PC == after.PC ? null : after.PC,
            SP = before.SP == after.SP ? null : after.SP,
            SREGByte = before.Sreg == after.Sreg ? null : after.Sreg,
            DataChanges = new List<DataChange>()
        };

        int length = Math.Min(before.DataSpace.Length, after.DataSpace.Length);
        for (int i = 0; i < length; i++)
        {
            byte b = before.DataSpace[i];
            byte a = after.DataSpace[i];
            if (b != a)
            {
                diff.DataChanges.Add(new DataChange { Index = i, Before = b, After = a });
            }
        }

        return diff;
    }

    // --- Registers and memory ------------------------------------------------------------------

    /// <summary>The Z pointer (R31:R30).</summary>
    public int Z
    {
        get => dataSpace[30] | (dataSpace[31] << 8);
        set { dataSpace[30] = (byte)value; dataSpace[31] = (byte)(value >> 8); }
    }

    public byte ReadData(int address) => address >= 0 && address < dataSpace.Length ? dataSpace[address] : (byte)0;

    // Writes go through here so I/O registers with side effects behave like hardware.
    public void WriteData(int address, byte value)
    {
        if (address < 0 || address >= dataSpace.Length) return;
        switch (address)
        {
            case TIFR0:
                // Interrupt flags are cleared by writing a 1 to them.
                dataSpace[address] &= (byte)~value;
                return;
            case PINB:
            case PINC:
            case PIND:
                // Writing a 1 to PINx toggles the matching PORTx bit.
                dataSpace[address + 2] ^= value;
                return;
        }
        dataSpace[address] = value;
    }

    // --- Status flags ----------------------------------------------------------------------------

    public bool GetFlag(int bit) => ((Sreg >> bit) & 1) != 0;

    public void SetFlag(int bit, bool on) => Sreg = on ? (byte)(Sreg | (1 << bit)) : (byte)(Sreg & ~(1 << bit));

    // The helpers below work out every flag an instruction changes and write SREG once. (Setting them one
    // at a time read and wrote SREG up to six times per instruction, a big share of the emulator's time.)
    private const int MaskC = 1 << SregBit.C, MaskZ = 1 << SregBit.Z, MaskN = 1 << SregBit.N,
        MaskV = 1 << SregBit.V, MaskS = 1 << SregBit.S, MaskH = 1 << SregBit.H;

    /// <summary>Replaces the flags in mask with the matching bits of flags.</summary>
    private void SetFlags(int mask, int flags) => Sreg = (byte)((Sreg & ~mask) | (flags & mask));

    private static int Bit(bool on, int mask) => on ? mask : 0;

    /// <summary>Flags for ADD/ADC (8-bit operands and result).</summary>
    public void SetAddFlags(int rd, int rr, int result)
    {
        int carries = (rd & rr) | (rr & ~result) | (~result & rd);
        bool v = (((rd & rr & ~result) | (~rd & ~rr & result)) & 0x80) != 0;
        bool n = (result & 0x80) != 0;
        SetFlags(MaskH | MaskV | MaskN | MaskS | MaskZ | MaskC,
            Bit((carries & 0x08) != 0, MaskH) | Bit(v, MaskV) | Bit(n, MaskN) | Bit(n ^ v, MaskS) |
            Bit((result & 0xFF) == 0, MaskZ) | Bit((carries & 0x80) != 0, MaskC));
    }

    /// <summary>Flags for SUB/SBC/CP/CPC/CPI/NEG. With chainZero (SBC, CPC, SBCI) Z only stays set if it already was.</summary>
    public void SetSubFlags(int rd, int rr, int result, bool chainZero)
    {
        int borrows = (~rd & rr) | (rr & result) | (result & ~rd);
        bool v = (((rd & ~rr & ~result) | (~rd & rr & result)) & 0x80) != 0;
        bool n = (result & 0x80) != 0;
        bool z = (result & 0xFF) == 0 && (!chainZero || GetFlag(SregBit.Z));
        SetFlags(MaskH | MaskV | MaskN | MaskS | MaskZ | MaskC,
            Bit((borrows & 0x08) != 0, MaskH) | Bit(v, MaskV) | Bit(n, MaskN) | Bit(n ^ v, MaskS) |
            Bit(z, MaskZ) | Bit((borrows & 0x80) != 0, MaskC));
    }

    /// <summary>Flags for AND/OR/EOR/COM and their immediate forms: V is cleared.</summary>
    public void SetLogicFlags(int result)
    {
        bool n = (result & 0x80) != 0;
        SetFlags(MaskV | MaskN | MaskS | MaskZ, Bit(n, MaskN) | Bit(n, MaskS) | Bit((result & 0xFF) == 0, MaskZ));
    }

    /// <summary>Flags for LSR/ASR/ROR, where carry is the bit shifted out.</summary>
    public void SetShiftFlags(int result, bool carry)
    {
        bool n = (result & 0x80) != 0;
        bool v = n ^ carry;
        SetFlags(MaskC | MaskN | MaskV | MaskS | MaskZ,
            Bit(carry, MaskC) | Bit(n, MaskN) | Bit(v, MaskV) | Bit(n ^ v, MaskS) | Bit((result & 0xFF) == 0, MaskZ));
    }

    /// <summary>Flags for INC/DEC: V, N, Z and S (C is left alone).</summary>
    public void SetIncDecFlags(int result, bool v)
    {
        bool n = (result & 0x80) != 0;
        SetFlags(MaskV | MaskN | MaskZ | MaskS, Bit(v, MaskV) | Bit(n, MaskN) | Bit((result & 0xFF) == 0, MaskZ) | Bit(n ^ v, MaskS));
    }

    /// <summary>Flags for ADIW/SBIW (16-bit result).</summary>
    public void SetWordFlags(int result, bool v, bool c)
    {
        bool n = (result & 0x8000) != 0;
        SetFlags(MaskV | MaskN | MaskZ | MaskC | MaskS,
            Bit(v, MaskV) | Bit(n, MaskN) | Bit((result & 0xFFFF) == 0, MaskZ) | Bit(c, MaskC) | Bit(n ^ v, MaskS));
    }

    /// <summary>Stores a MUL result in R1:R0 and sets C (bit 15) and Z.</summary>
    public void SetProduct(int product)
    {
        product &= 0xFFFF;
        dataSpace[0] = (byte)product;
        dataSpace[1] = (byte)(product >> 8);
        SetFlags(MaskC | MaskZ, Bit((product & 0x8000) != 0, MaskC) | Bit(product == 0, MaskZ));
    }

    // --- Control flow ----------------------------------------------------------------------------

    /// <summary>Size in words of the instruction at a word address: 2 for JMP/CALL/LDS/STS, otherwise 1.</summary>
    public int WordsAt(int pc)
    {
        int index = pc * 2;
        if (index + 1 >= ProgramMemory.Length) return 1;
        int op = ProgramMemory[index] | (ProgramMemory[index + 1] << 8); // flash is little-endian
        bool twoWords = (op & 0xFE0E) == 0x940C || (op & 0xFE0E) == 0x940E || (op & 0xFE0F) == 0x9000 || (op & 0xFE0F) == 0x9200;
        return twoWords ? 2 : 1;
    }

    /// <summary>Skips the following instruction (CPSE, SBRC, SBRS, SBIC, SBIS).</summary>
    public void SkipNext()
    {
        int words = WordsAt(PC + 1);
        PC += 1 + words;
        ExtraCycles += words;
    }

    // --- Stack (grows down; PUSH stores then decrements, POP increments then loads) ---------------

    public void PushByte(byte value)
    {
        if (SP <= 0x100) throw new InvalidOperationException("Stack overflow: the stack ran into the registers.");
        dataSpace[SP] = value;
        SP -= 1;
    }

    public byte PopByte()
    {
        if (SP >= RamEnd) throw new InvalidOperationException("Stack underflow: popped more than was pushed.");
        SP += 1;
        return dataSpace[SP];
    }

    /// <summary>Pushes a 2-byte return address, as CALL, RCALL, ICALL and interrupts do.</summary>
    public void PushReturnAddress(int pc)
    {
        PushByte((byte)pc);
        PushByte((byte)(pc >> 8));
    }

    public int PopReturnAddress()
    {
        int high = PopByte();
        int low = PopByte();
        return (high << 8) | low;
    }
}

public class SREG
{
    public byte SREGByte { get; set; } = 0;
    /*
        C: Carry
        Z: Zero
        N: Negative 
        V: Two's Complement
        S: Sign
        H: Half Carry
        T: Transfer
        I: Global
    */

    public void SetBit(byte index, bool bit)
    {
        byte mask = (byte)(1 << index);

        if (bit) SREGByte |= mask;
        else SREGByte &= (byte)~mask;
        ;
    }
}

// The frontend sends DataSpace as a plain array of numbers; System.Text.Json would otherwise expect
// a byte[] as a base64 string.
public class ByteArrayAsNumbersConverter : JsonConverter<byte[]>
{
    public override byte[] Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.String) return reader.GetBytesFromBase64();
        if (reader.TokenType != JsonTokenType.StartArray) throw new JsonException("Expected an array of bytes.");

        var bytes = new List<byte>();
        while (reader.Read() && reader.TokenType != JsonTokenType.EndArray)
        {
            bytes.Add(reader.GetByte());
        }
        return bytes.ToArray();
    }

    public override void Write(Utf8JsonWriter writer, byte[] value, JsonSerializerOptions options)
    {
        writer.WriteStartArray();
        foreach (var b in value) writer.WriteNumberValue(b);
        writer.WriteEndArray();
    }
}
