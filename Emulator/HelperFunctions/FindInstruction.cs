using SharedDomainTypes;

namespace Emulator;

public class FindInstruction
{
    // Every instruction class, tried in order; each checks the full opcode pattern. SEI and CLI come
    // before BSET and BCLR, which would otherwise match them too.
    public static readonly List<Func<List<byte>, CommandTemplate>> AllCommands = new()
    {
        b => new NOP(b), b => new SEI(b), b => new CLI(b), b => new BSET(b), b => new BCLR(b),
        b => new MOVW(b), b => new MULS(b), b => new MULSU(b),
        b => new CPC(b), b => new SBC(b), b => new ADD(b), b => new CPSE(b), b => new CP(b), b => new SUB(b), b => new ADC(b),
        b => new AND(b), b => new EOR(b), b => new OR(b), b => new MOV(b),
        b => new CPI(b), b => new SBCI(b), b => new SUBI(b), b => new ORI(b), b => new ANDI(b),
        b => new LDDZ(b), b => new LDDY(b), b => new STDZ(b), b => new STDY(b),
        b => new LDS(b), b => new LDZ(b), b => new LPM(b), b => new LDY(b), b => new LDX(b), b => new POP(b),
        b => new STS(b), b => new STZ(b), b => new STY(b), b => new STX(b), b => new PUSH(b),
        b => new COM(b), b => new NEG(b), b => new SWAP(b), b => new INC(b), b => new ASR(b), b => new LSR(b), b => new ROR(b), b => new DEC(b),
        b => new JMP(b), b => new CALL(b), b => new IJMP(b), b => new ICALL(b), b => new RET(b), b => new RETI(b),
        b => new ADIW(b), b => new SBIW(b), b => new CBI(b), b => new SBIC(b), b => new SBI(b), b => new SBIS(b), b => new MUL(b),
        b => new IN(b), b => new OUT(b), b => new RJMP(b), b => new RCALL(b), b => new LDI(b),
        b => new BRBS(b), b => new BRBC(b), b => new BLD(b), b => new BST(b), b => new SBRC(b), b => new SBRS(b),
    };

    public static CommandTemplate FindCommand(byte dataByte, byte opCodeByte)
    {
        // Store bytes in big-endian order: [opCodeByte, dataByte]
        List<byte> commandBytes = new List<byte> { opCodeByte, dataByte };

        foreach (var create in AllCommands)
        {
            CommandTemplate command = create(commandBytes);
            if (command.ConfirmCommand(dataByte, opCodeByte))
            {
                return command;
            }
        }

        return new UnknownCommand(commandBytes);
    }

    public List<CommandInformation> FindAllCommands(string[] hexLines) =>
        FindAllCommandTemplates(hexLines)
            .Select(c => new CommandInformation
            {
                CommandName = c.Command.Identifier,
                CommandBytes = c.Command.CommandBytes,
                ProgramAddressByte = c.ProgramAddressByte,
            })
            .ToList();

    // Should not send the command themselves, creates complications later 
    /// <summary>Decodes the program, keeping each instruction's command object and byte address.</summary>
    public List<(CommandTemplate Command, int ProgramAddressByte)> FindAllCommandTemplates(string[] hexLines)
    {
        var commands = new List<(CommandTemplate Command, int ProgramAddressByte)>();
        bool shouldTakeFromNextSpan = false;
        int currentProgramAddressByte = 0;
    
        for(int lineNum = 0; lineNum < hexLines.Length; lineNum++)
        {
            ReadOnlySpan<char> lineSpan = hexLines[lineNum].AsSpan();

            if(shouldTakeFromNextSpan)
            {
                lineSpan.Slice4Char(); // 4 is the max that would be taken from the next span
                shouldTakeFromNextSpan = false;
            }

            byte parseLength = (byte)lineSpan.Length;

            for(int i = 0; i < parseLength; i += 4)
            {   
                byte dataByte = (byte)lineSpan.Slice2Char();
                byte opCodeByte = (byte)lineSpan.Slice2Char();

                CommandTemplate command = FindCommand(dataByte, opCodeByte);
            
                for(int j = 0; j < command.AdditionalBytesNeeded; j += 2) // Two bytes added per iteration
                {
                    if(lineSpan.Length == 0)
                    {
                        shouldTakeFromNextSpan = true;
                        ReadOnlySpan<char> nextlineSpan = hexLines[lineNum + 1].AsSpan();
                        byte nextlowByte  = (byte)nextlineSpan.Slice2Char();
                        byte nexthighByte = (byte)nextlineSpan.Slice2Char();
                        command.CommandBytes.Add(nexthighByte);
                        command.CommandBytes.Add(nextlowByte);
                    }
                    else
                    {
                        byte lowByte  = (byte)lineSpan.Slice2Char();
                        byte highByte = (byte)lineSpan.Slice2Char();
                        command.CommandBytes.Add(highByte);
                        command.CommandBytes.Add(lowByte); 
                    }
                    
                    i += 4;
                }
                
                commands.Add((command, currentProgramAddressByte));

                currentProgramAddressByte += command.CommandBytes.Count;
            }
        }
        
        return commands;
    }
}