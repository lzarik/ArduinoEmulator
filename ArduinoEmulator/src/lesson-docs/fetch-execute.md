However complicated a program is, the CPU only ever does one thing, over and over: **fetch** an instruction (read it from memory), work out what it means, and carry it out. This loop is the heartbeat of every computer, from the Uno to a supercomputer.

## The parts of the CPU

| Part | Job |
|---|---|
| **Program counter (PC)** | Holds the address in flash of the next instruction |
| **Instruction register** | Holds the instruction currently being worked on |
| **Instruction decoder** | Works out what the instruction's bits mean and sets up the rest of the CPU |
| **Register file** | The whole set of 32 registers, R0 to R31 |
| **ALU** (arithmetic logic unit) | Does the actual math and logic: add, subtract, AND, OR, compare |
| **Status register (SREG)** | Flags (on/off bits) describing the last result: was it zero, negative, did it carry? |

## The cycle

1. **Fetch.** Read the 16-bit instruction at the address in the PC from flash into the instruction register.
2. **Decode.** The decoder looks at the bits and works out which instruction this is and which registers or constants it uses.
3. **Execute.** The ALU (or the memory unit) does the work: adds two registers, reads a byte, compares, and so on.
4. **Write back.** The result goes into its **destination** register (the one chosen to receive it) and the SREG flags are updated.
5. **Next.** The PC moves on by one word (or two, for a 32-bit instruction), unless the instruction was a jump, branch, call or return, which loads a new address into the PC instead. (A **branch** is a jump that only happens if a condition is true; a **call** jumps into a function, and a **return** comes back out of it.)

Then it starts again, 16 million times a second.

## Pipelining: overlapping the work

The ATmega328P doesn't wait for one instruction to finish before fetching the next. While it executes one instruction, it is already fetching the following one. This overlap is a **pipeline**, and it is why most AVR instructions finish in a single clock cycle.

The Harvard architecture makes this possible: flash and data memory are on separate buses, so fetching an instruction never competes with reading or writing data.

There is one catch. When a branch is **taken** (its condition is true, so it really jumps), the instruction that was already fetched is the wrong one, the one right after the branch. The CPU throws it away and fetches from the new address, which costs an extra cycle. That is why the datasheet lists conditional branches as 1 cycle if not taken and 2 if taken.

> [!NOTE]
> Modern desktop processors take this idea much further, with pipelines 15 to 20 stages deep, several instructions executing at once, and branch predictors that guess which way branches will go. The basic loop is still fetch, decode, execute.

## Watch it happen

In Ohmster, compile Blink, then press **Step** in the Code tab instead of Run. Each press runs exactly one trip around the cycle. Watch the debugger:

- **PC** goes up by 1 for most instructions and 2 for 32-bit ones such as `CALL` and `JMP`.
- On a `CALL` or `JMP`, the PC leaps to a completely different address.
- The **Cycles** count goes up by 1 for most instructions, and more for calls, returns and taken branches.
- Registers that changed light up.

You can also set the speed to **Instruction** and press Run to watch it step automatically.

## Key ideas

- The CPU repeats fetch, decode, execute, write back, and advance the PC.
- The PC holds the address of the next instruction; jumps and branches change it.
- AVR's pipeline fetches the next instruction while executing the current one, so most instructions take one cycle.
- A taken branch costs an extra cycle because the instruction fetched ahead of time is thrown away.

```quiz
Q: What does the program counter hold?
- [ ] The number of instructions run so far
- [x] The address of the next instruction to fetch
- [ ] The result of the last calculation
- [ ] The current time
= The PC points into flash at the next instruction. Jumps and branches work by loading a new value into it.

Q: Which part of the CPU actually adds two numbers?
- [ ] The program counter
- [ ] The instruction decoder
- [x] The ALU
- [ ] Flash memory
= The arithmetic logic unit performs arithmetic and logic operations on values from the registers.

Q: Why does a taken branch take 2 cycles instead of 1?
- [ ] Branches are 32-bit instructions
- [x] The pipeline already fetched the next instruction in line, which has to be thrown away
- [ ] The ALU is slow at comparing
- [ ] The branch has to wait for an interrupt
= While executing the branch, the CPU prefetched the instruction after it. If the branch is taken, that one is discarded and the target is fetched instead.
```
