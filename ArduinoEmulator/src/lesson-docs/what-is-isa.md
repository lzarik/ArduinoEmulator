You now know that C++ becomes machine code, that machine code lives in flash, and that the CPU works in registers. The last piece is the rulebook that ties them together: the **instruction set architecture**, or ISA.

## The contract

An ISA is the contract between software and a processor. It defines:

- **The instructions**: every operation the CPU can perform, such as add, compare, jump, load.
- **The registers**: how many there are, how wide they are, and any special roles.
- **The memory model**: how addresses work and how data is reached.
- **The encoding**: exactly which bits mean which instruction and which **operands** (the values an instruction works on, such as which registers).
- **The side effects**: which flags each instruction changes, and how many clock cycles it takes.

A compiler **targets** an ISA (produces machine code for it), not a particular chip. Any chip that **implements** the AVR ISA (follows its rules) can run the same machine code, even if its circuits are built completely differently inside. The circuitry that implements an ISA is called the **microarchitecture**. The ISA is *what* the CPU does; the microarchitecture is *how*.

> [!NOTE]
> This is why Ohmster can run your program: its emulator is a software implementation of the AVR ISA. Feed it the same machine code as a real ATmega328P and it does the same thing, instruction by instruction.

## The AVR ISA at a glance

| Feature | AVR (ATmega328P) |
|---|---|
| Data width | 8 bits: registers and the **ALU** (arithmetic logic unit, the part that does the maths) work on bytes |
| Registers | 32 general-purpose, R0 to R31 |
| Instruction size | Mostly 16 bits; a few are 32 bits |
| Style | RISC, load–store |
| Speed | Most instructions take 1 clock cycle |
| Memory | Harvard: separate program and data memory |

## RISC and CISC

There are two broad philosophies for designing an ISA:

- **RISC** (Reduced Instruction Set Computer): many simple instructions, each doing one small thing quickly. Only load and store instructions touch memory. AVR, ARM (in nearly every phone) and RISC-V are RISC.
- **CISC** (Complex Instruction Set Computer): fewer, more powerful instructions that can work on memory directly and take varying amounts of time. Intel and AMD's x86, the chips in most laptops and desktops, is the classic CISC.

On AVR, `x = x + y` with both variables in SRAM takes four instructions: load x, load y, add, store x. A CISC machine might do it in one or two. RISC wins by keeping every instruction simple enough to finish in a single cycle.

## The families of instructions

The ATmega328P's **datasheet** (the manufacturer's official manual for the chip) lists 131 instructions, in a handful of families. Each has a short abbreviated name called a **mnemonic**: `ADD` is add, `SUB` subtract, `INC` and `DEC` add or subtract one, `MOV` copy, `LD` and `ST` load and store, `JMP` jump, `BREQ` "branch if equal", and so on. To **branch** is to jump to a different part of the program:

| Family | Examples | What they do |
|---|---|---|
| Arithmetic and logic | `ADD` `ADC` `SUB` `INC` `DEC` `AND` `OR` `EOR` | Math on registers |
| Data transfer | `MOV` `LDI` `LDS` `STS` `LD` `ST` `IN` `OUT` `PUSH` `POP` | Move bytes between registers, memory and I/O |
| Branch | `RJMP` `JMP` `BREQ` `BRNE` `CALL` `RET` `RETI` | Change which instruction runs next |
| Bit and test | `SBI` `CBI` `SBRS` `LSL` `ROR` `SEI` `CLI` | Work on single bits and flags |

Every C++ statement you have written becomes some mix of these.

## Key ideas

- An ISA defines the instructions, registers, memory model and encoding a CPU supports.
- Compilers target the ISA; the microarchitecture is how a particular chip implements it.
- AVR is an 8-bit RISC, load–store, Harvard ISA with 32 registers and mostly 16-bit instructions.
- RISC uses many simple fast instructions; CISC uses fewer complex ones.

```quiz
Q: What is the difference between an ISA and a microarchitecture?
- [ ] They are two names for the same thing
- [x] The ISA defines what instructions do; the microarchitecture is the circuitry that carries them out
- [ ] The ISA is hardware and the microarchitecture is software
- [ ] The microarchitecture is the list of instructions
= The ISA is the contract software relies on. Different chips can implement the same ISA with different internal designs.

Q: In a load–store architecture like AVR, which instructions can access data memory?
- [ ] All of them
- [ ] Only ADD and SUB
- [x] Only the load and store (data transfer) instructions
- [ ] None of them
= Arithmetic only works on registers. Loads bring values in from memory and stores write them back.

Q: Which of these is a RISC ISA?
- [ ] x86
- [x] AVR
- [ ] Both x86 and AVR
- [ ] Neither
= AVR, ARM and RISC-V are RISC designs. x86 is the best-known CISC design.
```
