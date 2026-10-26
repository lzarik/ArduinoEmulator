namespace SharedDomainTypes;

[System.AttributeUsage(System.AttributeTargets.Class)]
public class GenerateCommandRegistryAttribute : System.Attribute { }

// One class per AVR instruction (ATmega328P). Class names must match Identifier: the generated
// CommandRegistry is keyed by class name and looked up by the identifier shown in the frontend.
//
// CommandBytes are stored high byte first, so the 16-bit opcode is (CommandBytes[0] << 8) | CommandBytes[1].
// PC counts 16-bit words, as on the real chip; 32-bit instructions (JMP, CALL, LDS, STS) are 2 words.
public abstract class CommandTemplate
{
    public List<byte> CommandBytes { get; protected set; }
    public abstract int AdditionalBytesNeeded { get; }
    public abstract string Identifier { get; }

    /// <summary>Base clock cycles. Branches and skips add to MachineData.ExtraCycles when taken.</summary>
    public virtual int Cycles => 1;
    public int Words => 1 + AdditionalBytesNeeded / 2;

    /// <summary>Print each executed instruction. Off by default: printing makes a full-speed run crawl.</summary>
    public static bool TraceToConsole { get; set; }

    protected CommandTemplate(List<byte> commandBytes)
    {
        CommandBytes = commandBytes;
    }

    public bool ConfirmCommand(byte dataByte, byte opCodeByte) => Matches((opCodeByte << 8) | dataByte);
    protected abstract bool Matches(int opcode);
    public abstract void RunCommand(MachineData program);

    // Operand fields decoded from the opcode. Cached because instructions run millions of times a second.
    private int opcode = -1;
    private int secondWord = -1;
    protected int Opcode => opcode >= 0 ? opcode : (opcode = (CommandBytes[0] << 8) | CommandBytes[1]);
    protected int SecondWord => secondWord >= 0 ? secondWord : (secondWord = (CommandBytes[2] << 8) | CommandBytes[3]);
    protected int Rd => (Opcode >> 4) & 0x1F;                     // ddddd: bits 8-4
    protected int Rr => (Opcode & 0x0F) | ((Opcode >> 5) & 0x10); // rrrrr: bit 9 and bits 3-0
    protected int RdHigh => 16 + ((Opcode >> 4) & 0x0F);          // R16-R31, for immediate instructions
    protected int K8 => ((Opcode >> 4) & 0xF0) | (Opcode & 0x0F); // KKKK ---- KKKK
    protected int IoBitAddress => 0x20 + ((Opcode >> 3) & 0x1F);  // A in SBI/CBI/SBIS/SBIC, as a data address
    protected int Bit => Opcode & 0x07;

    protected static void Log(string message)
    {
        if (TraceToConsole) Console.WriteLine(message);
    }

    // Interpolated messages ($"ADD R{Rd}, R{Rr}") are only formatted when tracing is on, so a full-speed
    // run doesn't build millions of strings it throws away.
    protected static void Log(TraceMessage message)
    {
        if (TraceToConsole) Console.WriteLine(message.ToStringAndClear());
    }
}

[System.Runtime.CompilerServices.InterpolatedStringHandler]
public ref struct TraceMessage
{
    private System.Runtime.CompilerServices.DefaultInterpolatedStringHandler inner;
    private readonly bool enabled;

    public TraceMessage(int literalLength, int formattedCount, out bool shouldAppend)
    {
        enabled = shouldAppend = CommandTemplate.TraceToConsole;
        inner = enabled ? new System.Runtime.CompilerServices.DefaultInterpolatedStringHandler(literalLength, formattedCount) : default;
    }

    public void AppendLiteral(string value) => inner.AppendLiteral(value);
    public void AppendFormatted<T>(T value) => inner.AppendFormatted(value);
    public void AppendFormatted<T>(T value, string? format) => inner.AppendFormatted(value, format);
    public string ToStringAndClear() => enabled ? inner.ToStringAndClear() : string.Empty;
}

public class UnknownCommand(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "NO COMMAND FOUND";
    public override int AdditionalBytesNeeded => 0;
    protected override bool Matches(int opcode) => false;
    public override void RunCommand(MachineData program) =>
        throw new InvalidOperationException($"Unsupported instruction 0x{Opcode:X4} at word address 0x{program.PC:X4}.");
}

// ===================================================================================================
// Arithmetic and logic
// ===================================================================================================

[GenerateCommandRegistry]
public class ADD(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "ADD";
    public override int AdditionalBytesNeeded => 0;
    // 0000 11rd dddd rrrr (LSL Rd is ADD Rd, Rd)
    protected override bool Matches(int op) => (op & 0xFC00) == 0x0C00;
    public override void RunCommand(MachineData program)
    {
        int rd = program.DataSpace[Rd], rr = program.DataSpace[Rr];
        int result = (rd + rr) & 0xFF;
        program.DataSpace[Rd] = (byte)result;
        program.SetAddFlags(rd, rr, result);
        program.PC += 1;
        Log($"ADD R{Rd}, R{Rr}");
    }
}

[GenerateCommandRegistry]
public class ADC(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "ADC";
    public override int AdditionalBytesNeeded => 0;
    // 0001 11rd dddd rrrr (ROL Rd is ADC Rd, Rd)
    protected override bool Matches(int op) => (op & 0xFC00) == 0x1C00;
    public override void RunCommand(MachineData program)
    {
        int rd = program.DataSpace[Rd], rr = program.DataSpace[Rr];
        int result = (rd + rr + (program.GetFlag(SregBit.C) ? 1 : 0)) & 0xFF;
        program.DataSpace[Rd] = (byte)result;
        program.SetAddFlags(rd, rr, result);
        program.PC += 1;
        Log($"ADC R{Rd}, R{Rr}");
    }
}

[GenerateCommandRegistry]
public class SUB(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "SUB";
    public override int AdditionalBytesNeeded => 0;
    // 0001 10rd dddd rrrr
    protected override bool Matches(int op) => (op & 0xFC00) == 0x1800;
    public override void RunCommand(MachineData program)
    {
        int rd = program.DataSpace[Rd], rr = program.DataSpace[Rr];
        int result = (rd - rr) & 0xFF;
        program.DataSpace[Rd] = (byte)result;
        program.SetSubFlags(rd, rr, result, chainZero: false);
        program.PC += 1;
        Log($"SUB R{Rd}, R{Rr}");
    }
}

[GenerateCommandRegistry]
public class SBC(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "SBC";
    public override int AdditionalBytesNeeded => 0;
    // 0000 10rd dddd rrrr
    protected override bool Matches(int op) => (op & 0xFC00) == 0x0800;
    public override void RunCommand(MachineData program)
    {
        int rd = program.DataSpace[Rd], rr = program.DataSpace[Rr];
        int result = (rd - rr - (program.GetFlag(SregBit.C) ? 1 : 0)) & 0xFF;
        program.DataSpace[Rd] = (byte)result;
        program.SetSubFlags(rd, rr, result, chainZero: true);
        program.PC += 1;
        Log($"SBC R{Rd}, R{Rr}");
    }
}

[GenerateCommandRegistry]
public class SUBI(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "SUBI";
    public override int AdditionalBytesNeeded => 0;
    // 0101 KKKK dddd KKKK
    protected override bool Matches(int op) => (op & 0xF000) == 0x5000;
    public override void RunCommand(MachineData program)
    {
        int rd = program.DataSpace[RdHigh];
        int result = (rd - K8) & 0xFF;
        program.DataSpace[RdHigh] = (byte)result;
        program.SetSubFlags(rd, K8, result, chainZero: false);
        program.PC += 1;
        Log($"SUBI R{RdHigh}, 0x{K8:X2}");
    }
}

[GenerateCommandRegistry]
public class SBCI(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "SBCI";
    public override int AdditionalBytesNeeded => 0;
    // 0100 KKKK dddd KKKK
    protected override bool Matches(int op) => (op & 0xF000) == 0x4000;
    public override void RunCommand(MachineData program)
    {
        int rd = program.DataSpace[RdHigh];
        int result = (rd - K8 - (program.GetFlag(SregBit.C) ? 1 : 0)) & 0xFF;
        program.DataSpace[RdHigh] = (byte)result;
        program.SetSubFlags(rd, K8, result, chainZero: true);
        program.PC += 1;
        Log($"SBCI R{RdHigh}, 0x{K8:X2}");
    }
}

[GenerateCommandRegistry]
public class ADIW(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "ADIW";
    public override int AdditionalBytesNeeded => 0;
    public override int Cycles => 2;
    // 1001 0110 KKdd KKKK, on the pairs R25:R24, R27:R26, R29:R28, R31:R30
    protected override bool Matches(int op) => (op & 0xFF00) == 0x9600;
    public override void RunCommand(MachineData program)
    {
        int d = 24 + ((Opcode >> 4) & 0x3) * 2;
        int k = ((Opcode >> 2) & 0x30) | (Opcode & 0x0F);
        int value = program.DataSpace[d] | (program.DataSpace[d + 1] << 8);
        int result = (value + k) & 0xFFFF;
        program.DataSpace[d] = (byte)result;
        program.DataSpace[d + 1] = (byte)(result >> 8);
        bool rdh7 = (value & 0x8000) != 0, r15 = (result & 0x8000) != 0;
        program.SetWordFlags(result, v: !rdh7 && r15, c: rdh7 && !r15);
        program.PC += 1;
        Log($"ADIW R{d + 1}:R{d}, {k}");
    }
}

[GenerateCommandRegistry]
public class SBIW(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "SBIW";
    public override int AdditionalBytesNeeded => 0;
    public override int Cycles => 2;
    // 1001 0111 KKdd KKKK
    protected override bool Matches(int op) => (op & 0xFF00) == 0x9700;
    public override void RunCommand(MachineData program)
    {
        int d = 24 + ((Opcode >> 4) & 0x3) * 2;
        int k = ((Opcode >> 2) & 0x30) | (Opcode & 0x0F);
        int value = program.DataSpace[d] | (program.DataSpace[d + 1] << 8);
        int result = (value - k) & 0xFFFF;
        program.DataSpace[d] = (byte)result;
        program.DataSpace[d + 1] = (byte)(result >> 8);
        bool rdh7 = (value & 0x8000) != 0, r15 = (result & 0x8000) != 0;
        program.SetWordFlags(result, v: rdh7 && !r15, c: r15 && !rdh7);
        program.PC += 1;
        Log($"SBIW R{d + 1}:R{d}, {k}");
    }
}

[GenerateCommandRegistry]
public class AND(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "AND";
    public override int AdditionalBytesNeeded => 0;
    // 0010 00rd dddd rrrr (TST Rd is AND Rd, Rd)
    protected override bool Matches(int op) => (op & 0xFC00) == 0x2000;
    public override void RunCommand(MachineData program)
    {
        int result = program.DataSpace[Rd] & program.DataSpace[Rr];
        program.DataSpace[Rd] = (byte)result;
        program.SetLogicFlags(result);
        program.PC += 1;
        Log($"AND R{Rd}, R{Rr}");
    }
}

[GenerateCommandRegistry]
public class ANDI(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "ANDI";
    public override int AdditionalBytesNeeded => 0;
    // 0111 KKKK dddd KKKK
    protected override bool Matches(int op) => (op & 0xF000) == 0x7000;
    public override void RunCommand(MachineData program)
    {
        int result = program.DataSpace[RdHigh] & K8;
        program.DataSpace[RdHigh] = (byte)result;
        program.SetLogicFlags(result);
        program.PC += 1;
        Log($"ANDI R{RdHigh}, 0x{K8:X2}");
    }
}

[GenerateCommandRegistry]
public class OR(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "OR";
    public override int AdditionalBytesNeeded => 0;
    // 0010 10rd dddd rrrr
    protected override bool Matches(int op) => (op & 0xFC00) == 0x2800;
    public override void RunCommand(MachineData program)
    {
        int result = program.DataSpace[Rd] | program.DataSpace[Rr];
        program.DataSpace[Rd] = (byte)result;
        program.SetLogicFlags(result);
        program.PC += 1;
        Log($"OR R{Rd}, R{Rr}");
    }
}

[GenerateCommandRegistry]
public class ORI(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "ORI";
    public override int AdditionalBytesNeeded => 0;
    // 0110 KKKK dddd KKKK
    protected override bool Matches(int op) => (op & 0xF000) == 0x6000;
    public override void RunCommand(MachineData program)
    {
        int result = program.DataSpace[RdHigh] | K8;
        program.DataSpace[RdHigh] = (byte)result;
        program.SetLogicFlags(result);
        program.PC += 1;
        Log($"ORI R{RdHigh}, 0x{K8:X2}");
    }
}

[GenerateCommandRegistry]
public class EOR(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "EOR";
    public override int AdditionalBytesNeeded => 0;
    // 0010 01rd dddd rrrr (CLR Rd is EOR Rd, Rd)
    protected override bool Matches(int op) => (op & 0xFC00) == 0x2400;
    public override void RunCommand(MachineData program)
    {
        int result = program.DataSpace[Rd] ^ program.DataSpace[Rr];
        program.DataSpace[Rd] = (byte)result;
        program.SetLogicFlags(result);
        program.PC += 1;
        Log($"EOR R{Rd}, R{Rr}");
    }
}

[GenerateCommandRegistry]
public class COM(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "COM";
    public override int AdditionalBytesNeeded => 0;
    // 1001 010d dddd 0000
    protected override bool Matches(int op) => (op & 0xFE0F) == 0x9400;
    public override void RunCommand(MachineData program)
    {
        int result = ~program.DataSpace[Rd] & 0xFF;
        program.DataSpace[Rd] = (byte)result;
        program.SetLogicFlags(result);
        program.SetFlag(SregBit.C, true);
        program.PC += 1;
        Log($"COM R{Rd}");
    }
}

[GenerateCommandRegistry]
public class NEG(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "NEG";
    public override int AdditionalBytesNeeded => 0;
    // 1001 010d dddd 0001
    protected override bool Matches(int op) => (op & 0xFE0F) == 0x9401;
    public override void RunCommand(MachineData program)
    {
        int rd = program.DataSpace[Rd];
        int result = (0 - rd) & 0xFF;
        program.DataSpace[Rd] = (byte)result;
        program.SetSubFlags(0, rd, result, chainZero: false);
        program.PC += 1;
        Log($"NEG R{Rd}");
    }
}

[GenerateCommandRegistry]
public class INC(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "INC";
    public override int AdditionalBytesNeeded => 0;
    // 1001 010d dddd 0011
    protected override bool Matches(int op) => (op & 0xFE0F) == 0x9403;
    public override void RunCommand(MachineData program)
    {
        int result = (program.DataSpace[Rd] + 1) & 0xFF;
        program.DataSpace[Rd] = (byte)result;
        program.SetIncDecFlags(result, v: result == 0x80);
        program.PC += 1;
        Log($"INC R{Rd}");
    }
}

[GenerateCommandRegistry]
public class DEC(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "DEC";
    public override int AdditionalBytesNeeded => 0;
    // 1001 010d dddd 1010
    protected override bool Matches(int op) => (op & 0xFE0F) == 0x940A;
    public override void RunCommand(MachineData program)
    {
        int result = (program.DataSpace[Rd] - 1) & 0xFF;
        program.DataSpace[Rd] = (byte)result;
        program.SetIncDecFlags(result, v: result == 0x7F);
        program.PC += 1;
        Log($"DEC R{Rd}");
    }
}

[GenerateCommandRegistry]
public class SWAP(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "SWAP";
    public override int AdditionalBytesNeeded => 0;
    // 1001 010d dddd 0010
    protected override bool Matches(int op) => (op & 0xFE0F) == 0x9402;
    public override void RunCommand(MachineData program)
    {
        int rd = program.DataSpace[Rd];
        program.DataSpace[Rd] = (byte)(((rd << 4) | (rd >> 4)) & 0xFF);
        program.PC += 1;
        Log($"SWAP R{Rd}");
    }
}

[GenerateCommandRegistry]
public class ASR(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "ASR";
    public override int AdditionalBytesNeeded => 0;
    // 1001 010d dddd 0101
    protected override bool Matches(int op) => (op & 0xFE0F) == 0x9405;
    public override void RunCommand(MachineData program)
    {
        int rd = program.DataSpace[Rd];
        int result = (rd >> 1) | (rd & 0x80);
        program.DataSpace[Rd] = (byte)result;
        program.SetShiftFlags(result, carry: (rd & 1) != 0);
        program.PC += 1;
        Log($"ASR R{Rd}");
    }
}

[GenerateCommandRegistry]
public class LSR(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "LSR";
    public override int AdditionalBytesNeeded => 0;
    // 1001 010d dddd 0110
    protected override bool Matches(int op) => (op & 0xFE0F) == 0x9406;
    public override void RunCommand(MachineData program)
    {
        int rd = program.DataSpace[Rd];
        int result = rd >> 1;
        program.DataSpace[Rd] = (byte)result;
        program.SetShiftFlags(result, carry: (rd & 1) != 0);
        program.PC += 1;
        Log($"LSR R{Rd}");
    }
}

[GenerateCommandRegistry]
public class ROR(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "ROR";
    public override int AdditionalBytesNeeded => 0;
    // 1001 010d dddd 0111
    protected override bool Matches(int op) => (op & 0xFE0F) == 0x9407;
    public override void RunCommand(MachineData program)
    {
        int rd = program.DataSpace[Rd];
        int result = (rd >> 1) | (program.GetFlag(SregBit.C) ? 0x80 : 0);
        program.DataSpace[Rd] = (byte)result;
        program.SetShiftFlags(result, carry: (rd & 1) != 0);
        program.PC += 1;
        Log($"ROR R{Rd}");
    }
}

[GenerateCommandRegistry]
public class MUL(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "MUL";
    public override int AdditionalBytesNeeded => 0;
    public override int Cycles => 2;
    // 1001 11rd dddd rrrr: R1:R0 = Rd * Rr (unsigned)
    protected override bool Matches(int op) => (op & 0xFC00) == 0x9C00;
    public override void RunCommand(MachineData program)
    {
        program.SetProduct(program.DataSpace[Rd] * program.DataSpace[Rr]);
        program.PC += 1;
        Log($"MUL R{Rd}, R{Rr}");
    }
}

[GenerateCommandRegistry]
public class MULS(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "MULS";
    public override int AdditionalBytesNeeded => 0;
    public override int Cycles => 2;
    // 0000 0010 dddd rrrr: signed, R16-R31
    protected override bool Matches(int op) => (op & 0xFF00) == 0x0200;
    public override void RunCommand(MachineData program)
    {
        int d = 16 + ((Opcode >> 4) & 0x0F), r = 16 + (Opcode & 0x0F);
        program.SetProduct((sbyte)program.DataSpace[d] * (sbyte)program.DataSpace[r]);
        program.PC += 1;
        Log($"MULS R{d}, R{r}");
    }
}

[GenerateCommandRegistry]
public class MULSU(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "MULSU";
    public override int AdditionalBytesNeeded => 0;
    public override int Cycles => 2;
    // 0000 0011 0ddd 0rrr: signed Rd times unsigned Rr, R16-R23
    protected override bool Matches(int op) => (op & 0xFF88) == 0x0300;
    public override void RunCommand(MachineData program)
    {
        int d = 16 + ((Opcode >> 4) & 0x07), r = 16 + (Opcode & 0x07);
        program.SetProduct((sbyte)program.DataSpace[d] * program.DataSpace[r]);
        program.PC += 1;
        Log($"MULSU R{d}, R{r}");
    }
}

// ===================================================================================================
// Comparisons
// ===================================================================================================

[GenerateCommandRegistry]
public class CP(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "CP";
    public override int AdditionalBytesNeeded => 0;
    // 0001 01rd dddd rrrr
    protected override bool Matches(int op) => (op & 0xFC00) == 0x1400;
    public override void RunCommand(MachineData program)
    {
        int rd = program.DataSpace[Rd], rr = program.DataSpace[Rr];
        program.SetSubFlags(rd, rr, (rd - rr) & 0xFF, chainZero: false);
        program.PC += 1;
        Log($"CP R{Rd}, R{Rr}");
    }
}

[GenerateCommandRegistry]
public class CPC(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "CPC";
    public override int AdditionalBytesNeeded => 0;
    // 0000 01rd dddd rrrr
    protected override bool Matches(int op) => (op & 0xFC00) == 0x0400;
    public override void RunCommand(MachineData program)
    {
        int rd = program.DataSpace[Rd], rr = program.DataSpace[Rr];
        int result = (rd - rr - (program.GetFlag(SregBit.C) ? 1 : 0)) & 0xFF;
        program.SetSubFlags(rd, rr, result, chainZero: true);
        program.PC += 1;
        Log($"CPC R{Rd}, R{Rr}");
    }
}

[GenerateCommandRegistry]
public class CPI(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "CPI";
    public override int AdditionalBytesNeeded => 0;
    // 0011 KKKK dddd KKKK
    protected override bool Matches(int op) => (op & 0xF000) == 0x3000;
    public override void RunCommand(MachineData program)
    {
        int rd = program.DataSpace[RdHigh];
        program.SetSubFlags(rd, K8, (rd - K8) & 0xFF, chainZero: false);
        program.PC += 1;
        Log($"CPI R{RdHigh}, 0x{K8:X2}");
    }
}

[GenerateCommandRegistry]
public class CPSE(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "CPSE";
    public override int AdditionalBytesNeeded => 0;
    // 0001 00rd dddd rrrr: skip the next instruction if Rd == Rr
    protected override bool Matches(int op) => (op & 0xFC00) == 0x1000;
    public override void RunCommand(MachineData program)
    {
        bool equal = program.DataSpace[Rd] == program.DataSpace[Rr];
        if (equal) program.SkipNext();
        else program.PC += 1;
        Log($"CPSE R{Rd}, R{Rr}{(equal ? " (skip)" : "")}");
    }
}

// ===================================================================================================
// Jumps, calls and branches
// ===================================================================================================

[GenerateCommandRegistry]
public class RJMP(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "RJMP";
    public override int AdditionalBytesNeeded => 0;
    public override int Cycles => 2;
    // 1100 kkkk kkkk kkkk: k is a signed 12-bit word offset
    protected override bool Matches(int op) => (op & 0xF000) == 0xC000;
    public override void RunCommand(MachineData program)
    {
        int k = SignExtend(Opcode & 0x0FFF, 12);
        program.PC += k + 1;
        Log($"RJMP {k}");
    }

    internal static int SignExtend(int value, int bits) => (value << (32 - bits)) >> (32 - bits);
}

[GenerateCommandRegistry]
public class RCALL(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "RCALL";
    public override int AdditionalBytesNeeded => 0;
    public override int Cycles => 3;
    // 1101 kkkk kkkk kkkk
    protected override bool Matches(int op) => (op & 0xF000) == 0xD000;
    public override void RunCommand(MachineData program)
    {
        int k = RJMP.SignExtend(Opcode & 0x0FFF, 12);
        program.PushReturnAddress(program.PC + 1);
        program.PC += k + 1;
        Log($"RCALL {k}");
    }
}

[GenerateCommandRegistry]
public class JMP(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "JMP";
    public override int AdditionalBytesNeeded => 2;
    public override int Cycles => 3;
    // 1001 010k kkkk 110k kkkk kkkk kkkk kkkk: absolute word address
    protected override bool Matches(int op) => (op & 0xFE0E) == 0x940C;
    public override void RunCommand(MachineData program)
    {
        int address = (((Opcode >> 3) & 0x3E) | (Opcode & 1)) << 16 | SecondWord;
        program.PC = address;
        Log($"JMP 0x{address:X4}");
    }
}

[GenerateCommandRegistry]
public class CALL(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "CALL";
    public override int AdditionalBytesNeeded => 2;
    public override int Cycles => 4;
    // 1001 010k kkkk 111k kkkk kkkk kkkk kkkk
    protected override bool Matches(int op) => (op & 0xFE0E) == 0x940E;
    public override void RunCommand(MachineData program)
    {
        int address = (((Opcode >> 3) & 0x3E) | (Opcode & 1)) << 16 | SecondWord;
        program.PushReturnAddress(program.PC + 2);
        program.PC = address;
        Log($"CALL 0x{address:X4}");
    }
}

[GenerateCommandRegistry]
public class IJMP(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "IJMP";
    public override int AdditionalBytesNeeded => 0;
    public override int Cycles => 2;
    // 1001 0100 0000 1001: jump to the word address in Z
    protected override bool Matches(int op) => op == 0x9409;
    public override void RunCommand(MachineData program)
    {
        program.PC = program.Z;
        Log("IJMP");
    }
}

[GenerateCommandRegistry]
public class ICALL(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "ICALL";
    public override int AdditionalBytesNeeded => 0;
    public override int Cycles => 3;
    // 1001 0101 0000 1001
    protected override bool Matches(int op) => op == 0x9509;
    public override void RunCommand(MachineData program)
    {
        program.PushReturnAddress(program.PC + 1);
        program.PC = program.Z;
        Log("ICALL");
    }
}

[GenerateCommandRegistry]
public class RET(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "RET";
    public override int AdditionalBytesNeeded => 0;
    public override int Cycles => 4;
    protected override bool Matches(int op) => op == 0x9508;
    public override void RunCommand(MachineData program)
    {
        program.PC = program.PopReturnAddress();
        Log("RET");
    }
}

[GenerateCommandRegistry]
public class RETI(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "RETI";
    public override int AdditionalBytesNeeded => 0;
    public override int Cycles => 4;
    protected override bool Matches(int op) => op == 0x9518;
    public override void RunCommand(MachineData program)
    {
        program.PC = program.PopReturnAddress();
        program.SetFlag(SregBit.I, true);
        Log("RETI");
    }
}

[GenerateCommandRegistry]
public class BRBS(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "BRBS";
    public override int AdditionalBytesNeeded => 0;
    // 1111 00kk kkkk ksss: branch if SREG bit s is set (BREQ, BRCS, BRMI, ...)
    protected override bool Matches(int op) => (op & 0xFC00) == 0xF000;
    public override void RunCommand(MachineData program)
    {
        int k = RJMP.SignExtend((Opcode >> 3) & 0x7F, 7);
        bool taken = program.GetFlag(Bit);
        program.PC += taken ? k + 1 : 1;
        if (taken) program.ExtraCycles += 1;
        Log($"BRBS {Bit}, {k}{(taken ? "" : " (not taken)")}");
    }
}

[GenerateCommandRegistry]
public class BRBC(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "BRBC";
    public override int AdditionalBytesNeeded => 0;
    // 1111 01kk kkkk ksss: branch if SREG bit s is clear (BRNE, BRCC, BRPL, ...)
    protected override bool Matches(int op) => (op & 0xFC00) == 0xF400;
    public override void RunCommand(MachineData program)
    {
        int k = RJMP.SignExtend((Opcode >> 3) & 0x7F, 7);
        bool taken = !program.GetFlag(Bit);
        program.PC += taken ? k + 1 : 1;
        if (taken) program.ExtraCycles += 1;
        Log($"BRBC {Bit}, {k}{(taken ? "" : " (not taken)")}");
    }
}

[GenerateCommandRegistry]
public class SBRC(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "SBRC";
    public override int AdditionalBytesNeeded => 0;
    // 1111 110r rrrr 0bbb: skip if bit b of Rr is clear
    protected override bool Matches(int op) => (op & 0xFE08) == 0xFC00;
    public override void RunCommand(MachineData program)
    {
        bool skip = ((program.DataSpace[Rd] >> Bit) & 1) == 0;
        if (skip) program.SkipNext();
        else program.PC += 1;
        Log($"SBRC R{Rd}, {Bit}");
    }
}

[GenerateCommandRegistry]
public class SBRS(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "SBRS";
    public override int AdditionalBytesNeeded => 0;
    // 1111 111r rrrr 0bbb: skip if bit b of Rr is set
    protected override bool Matches(int op) => (op & 0xFE08) == 0xFE00;
    public override void RunCommand(MachineData program)
    {
        bool skip = ((program.DataSpace[Rd] >> Bit) & 1) == 1;
        if (skip) program.SkipNext();
        else program.PC += 1;
        Log($"SBRS R{Rd}, {Bit}");
    }
}

[GenerateCommandRegistry]
public class SBIC(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "SBIC";
    public override int AdditionalBytesNeeded => 0;
    // 1001 1001 AAAA Abbb: skip if bit b of I/O register A is clear
    protected override bool Matches(int op) => (op & 0xFF00) == 0x9900;
    public override void RunCommand(MachineData program)
    {
        bool skip = ((program.ReadData(IoBitAddress) >> Bit) & 1) == 0;
        if (skip) program.SkipNext();
        else program.PC += 1;
        Log($"SBIC 0x{IoBitAddress - 0x20:X2}, {Bit}");
    }
}

[GenerateCommandRegistry]
public class SBIS(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "SBIS";
    public override int AdditionalBytesNeeded => 0;
    // 1001 1011 AAAA Abbb: skip if bit b of I/O register A is set
    protected override bool Matches(int op) => (op & 0xFF00) == 0x9B00;
    public override void RunCommand(MachineData program)
    {
        bool skip = ((program.ReadData(IoBitAddress) >> Bit) & 1) == 1;
        if (skip) program.SkipNext();
        else program.PC += 1;
        Log($"SBIS 0x{IoBitAddress - 0x20:X2}, {Bit}");
    }
}

// ===================================================================================================
// Data transfer
// ===================================================================================================

[GenerateCommandRegistry]
public class MOV(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "MOV";
    public override int AdditionalBytesNeeded => 0;
    // 0010 11rd dddd rrrr
    protected override bool Matches(int op) => (op & 0xFC00) == 0x2C00;
    public override void RunCommand(MachineData program)
    {
        program.DataSpace[Rd] = program.DataSpace[Rr];
        program.PC += 1;
        Log($"MOV R{Rd}, R{Rr}");
    }
}

[GenerateCommandRegistry]
public class MOVW(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "MOVW";
    public override int AdditionalBytesNeeded => 0;
    // 0000 0001 dddd rrrr: copy register pair Rr+1:Rr to Rd+1:Rd
    protected override bool Matches(int op) => (op & 0xFF00) == 0x0100;
    public override void RunCommand(MachineData program)
    {
        int d = ((Opcode >> 4) & 0x0F) * 2, r = (Opcode & 0x0F) * 2;
        program.DataSpace[d] = program.DataSpace[r];
        program.DataSpace[d + 1] = program.DataSpace[r + 1];
        program.PC += 1;
        Log($"MOVW R{d + 1}:R{d}, R{r + 1}:R{r}");
    }
}

[GenerateCommandRegistry]
public class LDI(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "LDI";
    public override int AdditionalBytesNeeded => 0;
    // 1110 KKKK dddd KKKK (SER Rd is LDI Rd, 0xFF)
    protected override bool Matches(int op) => (op & 0xF000) == 0xE000;
    public override void RunCommand(MachineData program)
    {
        program.DataSpace[RdHigh] = (byte)K8;
        program.PC += 1;
        Log($"LDI R{RdHigh}, 0x{K8:X2}");
    }
}

[GenerateCommandRegistry]
public class LDS(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "LDS";
    public override int AdditionalBytesNeeded => 2;
    public override int Cycles => 2;
    // 1001 000d dddd 0000 kkkk kkkk kkkk kkkk
    protected override bool Matches(int op) => (op & 0xFE0F) == 0x9000;
    public override void RunCommand(MachineData program)
    {
        program.DataSpace[Rd] = program.ReadData(SecondWord);
        program.PC += 2;
        Log($"LDS R{Rd}, 0x{SecondWord:X4}");
    }
}

[GenerateCommandRegistry]
public class STS(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "STS";
    public override int AdditionalBytesNeeded => 2;
    public override int Cycles => 2;
    // 1001 001r rrrr 0000 kkkk kkkk kkkk kkkk
    protected override bool Matches(int op) => (op & 0xFE0F) == 0x9200;
    public override void RunCommand(MachineData program)
    {
        program.WriteData(SecondWord, program.DataSpace[Rd]);
        program.PC += 2;
        Log($"STS 0x{SecondWord:X4}, R{Rd}");
    }
}

// Indirect loads and stores through the X (R27:R26), Y (R29:R28) and Z (R31:R30) pointers.
// The low nibble picks the mode: plain, post-increment (+) or pre-decrement (-).
public abstract class PointerAccess(List<byte> commandBytes, int pointer, string name) : CommandTemplate(commandBytes)
{
    public override int AdditionalBytesNeeded => 0;
    public override int Cycles => 2;
    protected bool PostIncrement => (Opcode & 0x3) == 1;
    protected bool PreDecrement => (Opcode & 0x3) == 2;

    // Returns the address to use and updates the pointer register for +/- modes.
    protected int Address(MachineData program)
    {
        int value = program.DataSpace[pointer] | (program.DataSpace[pointer + 1] << 8);
        if (PreDecrement) value = (value - 1) & 0xFFFF;
        int address = value;
        if (PostIncrement) value = (value + 1) & 0xFFFF;
        program.DataSpace[pointer] = (byte)value;
        program.DataSpace[pointer + 1] = (byte)(value >> 8);
        return address;
    }

    protected string Operand => $"{(PreDecrement ? "-" : "")}{name}{(PostIncrement ? "+" : "")}";
}

[GenerateCommandRegistry]
public class LDX(List<byte> commandBytes) : PointerAccess(commandBytes, 26, "X")
{
    public override string Identifier => "LDX";
    // 1001 000d dddd 1100 / 1101 / 1110
    protected override bool Matches(int op) => (op & 0xFE0F) is 0x900C or 0x900D or 0x900E;
    public override void RunCommand(MachineData program)
    {
        program.DataSpace[Rd] = program.ReadData(Address(program));
        program.PC += 1;
        Log($"LD R{Rd}, {Operand}");
    }
}

[GenerateCommandRegistry]
public class LDY(List<byte> commandBytes) : PointerAccess(commandBytes, 28, "Y")
{
    public override string Identifier => "LDY";
    // 1001 000d dddd 1001 / 1010 (plain LD Y is LDD with q = 0)
    protected override bool Matches(int op) => (op & 0xFE0F) is 0x9009 or 0x900A;
    public override void RunCommand(MachineData program)
    {
        program.DataSpace[Rd] = program.ReadData(Address(program));
        program.PC += 1;
        Log($"LD R{Rd}, {Operand}");
    }
}

[GenerateCommandRegistry]
public class LDZ(List<byte> commandBytes) : PointerAccess(commandBytes, 30, "Z")
{
    public override string Identifier => "LDZ";
    // 1001 000d dddd 0001 / 0010
    protected override bool Matches(int op) => (op & 0xFE0F) is 0x9001 or 0x9002;
    public override void RunCommand(MachineData program)
    {
        program.DataSpace[Rd] = program.ReadData(Address(program));
        program.PC += 1;
        Log($"LD R{Rd}, {Operand}");
    }
}

[GenerateCommandRegistry]
public class STX(List<byte> commandBytes) : PointerAccess(commandBytes, 26, "X")
{
    public override string Identifier => "STX";
    // 1001 001r rrrr 1100 / 1101 / 1110
    protected override bool Matches(int op) => (op & 0xFE0F) is 0x920C or 0x920D or 0x920E;
    public override void RunCommand(MachineData program)
    {
        program.WriteData(Address(program), program.DataSpace[Rd]);
        program.PC += 1;
        Log($"ST {Operand}, R{Rd}");
    }
}

[GenerateCommandRegistry]
public class STY(List<byte> commandBytes) : PointerAccess(commandBytes, 28, "Y")
{
    public override string Identifier => "STY";
    // 1001 001r rrrr 1001 / 1010
    protected override bool Matches(int op) => (op & 0xFE0F) is 0x9209 or 0x920A;
    public override void RunCommand(MachineData program)
    {
        program.WriteData(Address(program), program.DataSpace[Rd]);
        program.PC += 1;
        Log($"ST {Operand}, R{Rd}");
    }
}

[GenerateCommandRegistry]
public class STZ(List<byte> commandBytes) : PointerAccess(commandBytes, 30, "Z")
{
    public override string Identifier => "STZ";
    // 1001 001r rrrr 0001 / 0010
    protected override bool Matches(int op) => (op & 0xFE0F) is 0x9201 or 0x9202;
    public override void RunCommand(MachineData program)
    {
        program.WriteData(Address(program), program.DataSpace[Rd]);
        program.PC += 1;
        Log($"ST {Operand}, R{Rd}");
    }
}

// LDD/STD Rd, Y+q or Z+q: 10q0 qq0d dddd yqqq, where bit 9 = store and y picks Y (1) or Z (0).
public abstract class DisplacementAccess(List<byte> commandBytes, int pointer, string name) : CommandTemplate(commandBytes)
{
    public override int AdditionalBytesNeeded => 0;
    public override int Cycles => 2;
    protected int Q => ((Opcode >> 8) & 0x20) | ((Opcode >> 7) & 0x18) | (Opcode & 0x07);
    protected int Address(MachineData program) =>
        ((program.DataSpace[pointer] | (program.DataSpace[pointer + 1] << 8)) + Q) & 0xFFFF;
    protected string Operand => Q == 0 ? name : $"{name}+{Q}";
}

[GenerateCommandRegistry]
public class LDDY(List<byte> commandBytes) : DisplacementAccess(commandBytes, 28, "Y")
{
    public override string Identifier => "LDDY";
    protected override bool Matches(int op) => (op & 0xD208) == 0x8008;
    public override void RunCommand(MachineData program)
    {
        program.DataSpace[Rd] = program.ReadData(Address(program));
        program.PC += 1;
        Log($"LDD R{Rd}, {Operand}");
    }
}

[GenerateCommandRegistry]
public class LDDZ(List<byte> commandBytes) : DisplacementAccess(commandBytes, 30, "Z")
{
    public override string Identifier => "LDDZ";
    protected override bool Matches(int op) => (op & 0xD208) == 0x8000;
    public override void RunCommand(MachineData program)
    {
        program.DataSpace[Rd] = program.ReadData(Address(program));
        program.PC += 1;
        Log($"LDD R{Rd}, {Operand}");
    }
}

[GenerateCommandRegistry]
public class STDY(List<byte> commandBytes) : DisplacementAccess(commandBytes, 28, "Y")
{
    public override string Identifier => "STDY";
    protected override bool Matches(int op) => (op & 0xD208) == 0x8208;
    public override void RunCommand(MachineData program)
    {
        program.WriteData(Address(program), program.DataSpace[Rd]);
        program.PC += 1;
        Log($"STD {Operand}, R{Rd}");
    }
}

[GenerateCommandRegistry]
public class STDZ(List<byte> commandBytes) : DisplacementAccess(commandBytes, 30, "Z")
{
    public override string Identifier => "STDZ";
    protected override bool Matches(int op) => (op & 0xD208) == 0x8200;
    public override void RunCommand(MachineData program)
    {
        program.WriteData(Address(program), program.DataSpace[Rd]);
        program.PC += 1;
        Log($"STD {Operand}, R{Rd}");
    }
}

[GenerateCommandRegistry]
public class LPM(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "LPM";
    public override int AdditionalBytesNeeded => 0;
    public override int Cycles => 3;
    // Reads program memory (flash) at the byte address in Z.
    // 1001 0101 1100 1000: LPM (into R0)   1001 000d dddd 0100 / 0101: LPM Rd, Z / Z+
    protected override bool Matches(int op) => op == 0x95C8 || (op & 0xFE0E) == 0x9004;
    public override void RunCommand(MachineData program)
    {
        bool implied = Opcode == 0x95C8;
        int target = implied ? 0 : Rd;
        int z = program.Z;
        program.DataSpace[target] = z < program.ProgramMemory.Length ? program.ProgramMemory[z] : (byte)0xFF;
        if (!implied && (Opcode & 1) == 1) program.Z = (z + 1) & 0xFFFF;
        program.PC += 1;
        if (implied) Log("LPM");
        else Log($"LPM R{target}, Z{((Opcode & 1) == 1 ? "+" : "")}");
    }
}

[GenerateCommandRegistry]
public class IN(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "IN";
    public override int AdditionalBytesNeeded => 0;
    // 1011 0AAd dddd AAAA: I/O address A is data address A + 0x20
    protected override bool Matches(int op) => (op & 0xF800) == 0xB000;
    public override void RunCommand(MachineData program)
    {
        int io = ((Opcode >> 5) & 0x30) | (Opcode & 0x0F);
        program.DataSpace[Rd] = program.ReadData(io + 0x20);
        program.PC += 1;
        Log($"IN R{Rd}, 0x{io:X2}");
    }
}

[GenerateCommandRegistry]
public class OUT(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "OUT";
    public override int AdditionalBytesNeeded => 0;
    // 1011 1AAr rrrr AAAA
    protected override bool Matches(int op) => (op & 0xF800) == 0xB800;
    public override void RunCommand(MachineData program)
    {
        int io = ((Opcode >> 5) & 0x30) | (Opcode & 0x0F);
        program.WriteData(io + 0x20, program.DataSpace[Rd]);
        program.PC += 1;
        Log($"OUT 0x{io:X2}, R{Rd}");
    }
}

[GenerateCommandRegistry]
public class PUSH(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "PUSH";
    public override int AdditionalBytesNeeded => 0;
    public override int Cycles => 2;
    // 1001 001r rrrr 1111
    protected override bool Matches(int op) => (op & 0xFE0F) == 0x920F;
    public override void RunCommand(MachineData program)
    {
        program.PushByte(program.DataSpace[Rd]);
        program.PC += 1;
        Log($"PUSH R{Rd}");
    }
}

[GenerateCommandRegistry]
public class POP(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "POP";
    public override int AdditionalBytesNeeded => 0;
    public override int Cycles => 2;
    // 1001 000d dddd 1111
    protected override bool Matches(int op) => (op & 0xFE0F) == 0x900F;
    public override void RunCommand(MachineData program)
    {
        program.DataSpace[Rd] = program.PopByte();
        program.PC += 1;
        Log($"POP R{Rd}");
    }
}

// ===================================================================================================
// Bit operations
// ===================================================================================================

[GenerateCommandRegistry]
public class SBI(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "SBI";
    public override int AdditionalBytesNeeded => 0;
    public override int Cycles => 2;
    // 1001 1010 AAAA Abbb: set bit b of I/O register A
    protected override bool Matches(int op) => (op & 0xFF00) == 0x9A00;
    public override void RunCommand(MachineData program)
    {
        program.WriteData(IoBitAddress, (byte)(program.ReadData(IoBitAddress) | (1 << Bit)));
        program.PC += 1;
        Log($"SBI 0x{IoBitAddress - 0x20:X2}, {Bit}");
    }
}

[GenerateCommandRegistry]
public class CBI(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "CBI";
    public override int AdditionalBytesNeeded => 0;
    public override int Cycles => 2;
    // 1001 1000 AAAA Abbb: clear bit b of I/O register A
    protected override bool Matches(int op) => (op & 0xFF00) == 0x9800;
    public override void RunCommand(MachineData program)
    {
        program.WriteData(IoBitAddress, (byte)(program.ReadData(IoBitAddress) & ~(1 << Bit)));
        program.PC += 1;
        Log($"CBI 0x{IoBitAddress - 0x20:X2}, {Bit}");
    }
}

[GenerateCommandRegistry]
public class BST(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "BST";
    public override int AdditionalBytesNeeded => 0;
    // 1111 101d dddd 0bbb: T = bit b of Rd
    protected override bool Matches(int op) => (op & 0xFE08) == 0xFA00;
    public override void RunCommand(MachineData program)
    {
        program.SetFlag(SregBit.T, ((program.DataSpace[Rd] >> Bit) & 1) == 1);
        program.PC += 1;
        Log($"BST R{Rd}, {Bit}");
    }
}

[GenerateCommandRegistry]
public class BLD(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "BLD";
    public override int AdditionalBytesNeeded => 0;
    // 1111 100d dddd 0bbb: bit b of Rd = T
    protected override bool Matches(int op) => (op & 0xFE08) == 0xF800;
    public override void RunCommand(MachineData program)
    {
        int value = program.DataSpace[Rd];
        value = program.GetFlag(SregBit.T) ? value | (1 << Bit) : value & ~(1 << Bit);
        program.DataSpace[Rd] = (byte)value;
        program.PC += 1;
        Log($"BLD R{Rd}, {Bit}");
    }
}

[GenerateCommandRegistry]
public class SEI(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "SEI";
    public override int AdditionalBytesNeeded => 0;
    protected override bool Matches(int op) => op == 0x9478;
    public override void RunCommand(MachineData program)
    {
        program.SetFlag(SregBit.I, true);
        program.PC += 1;
        Log("SEI");
    }
}

[GenerateCommandRegistry]
public class CLI(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "CLI";
    public override int AdditionalBytesNeeded => 0;
    protected override bool Matches(int op) => op == 0x94F8;
    public override void RunCommand(MachineData program)
    {
        program.SetFlag(SregBit.I, false);
        program.PC += 1;
        Log("CLI");
    }
}

[GenerateCommandRegistry]
public class BSET(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "BSET";
    public override int AdditionalBytesNeeded => 0;
    // 1001 0100 0sss 1000: set SREG bit s (SEC, SEZ, SEN, ...)
    protected override bool Matches(int op) => (op & 0xFF8F) == 0x9408;
    public override void RunCommand(MachineData program)
    {
        int s = (Opcode >> 4) & 0x7;
        program.SetFlag(s, true);
        program.PC += 1;
        Log($"BSET {s}");
    }
}

[GenerateCommandRegistry]
public class BCLR(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "BCLR";
    public override int AdditionalBytesNeeded => 0;
    // 1001 0100 1sss 1000: clear SREG bit s (CLC, CLZ, CLN, ...)
    protected override bool Matches(int op) => (op & 0xFF8F) == 0x9488;
    public override void RunCommand(MachineData program)
    {
        int s = (Opcode >> 4) & 0x7;
        program.SetFlag(s, false);
        program.PC += 1;
        Log($"BCLR {s}");
    }
}

// ===================================================================================================
// MCU control (no-ops here: there is no sleep mode, watchdog or debugger to talk to)
// ===================================================================================================

[GenerateCommandRegistry]
public class NOP(List<byte> commandBytes) : CommandTemplate(commandBytes)
{
    public override string Identifier => "NOP";
    public override int AdditionalBytesNeeded => 0;
    // NOP 0x0000, SLEEP 0x9588, BREAK 0x9598, WDR 0x95A8
    protected override bool Matches(int op) => op is 0x0000 or 0x9588 or 0x9598 or 0x95A8;
    public override void RunCommand(MachineData program)
    {
        program.PC += 1;
        Log("NOP");
    }
}
