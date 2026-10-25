Programs don't just run top to bottom. They loop, skip, call functions and return. All of that comes down to a few instructions that load a new value into the program counter, plus one **data structure** (a way of organising data in memory): the stack.

## Jumps

| Instruction | Size | Reach | Cycles |
|---|---|---|---|
| `RJMP k` | 1 word | ±2K words, relative to the PC | 2 |
| `JMP k` | 2 words | Anywhere in flash | 3 |
| `BRxx k` | 1 word | −64 to +63 words, relative | 1, or 2 if taken |

Relative jumps store an offset from the current position instead of a full address, which keeps them to one word. Conditional branches have the shortest reach (their word also has to hold which flag to test). So to reach somewhere far away, the compiler uses a trick: it reverses the test and uses the short branch to skip over a full `JMP`.

## Calls and returns

A function call has to come back. `CALL` and `RCALL` (relative call, a shorter one-word version) work like jumps, but first they save the **return address** (the address of the instruction after the call) on the stack. `RET` pops it off the stack into the PC.

On the ATmega328P the PC is 14 bits, so a return address takes **2 bytes** of stack.

## The stack in action

The stack pointer starts at `0x08FF`, the top of SRAM. Suppose `loop()` calls `blinkOnce()` at word address `0x00A0`, and the next instruction is at `0x00A2`:

1. `CALL blinkOnce` pushes `0x00A2`: one byte at 0x08FF, the other at 0x08FE. SP drops to `0x08FD`.
2. The PC is set to `blinkOnce`'s address and its code runs.
3. `blinkOnce` calls `digitalWrite`, which pushes another return address. SP drops to `0x08FB`.
4. `digitalWrite` ends with `RET`: pop two bytes, SP back to 0x08FD, jump back into `blinkOnce`.
5. `blinkOnce` ends with `RET`: SP back to 0x08FF, jump to `0x00A2` in `loop()`.

Because the last address pushed is the first one popped, **nested** calls (a function calling a function calling another) always unwind back out in the right order. **Recursion** (a function calling itself) works the same way, one return address per level, which is also why deep recursion can fill a 2 KB stack quickly.

## PUSH and POP

Functions also use the stack to save registers they need to borrow:

```asm
myFunction:
        push r28          ; save the caller's r28 and r29
        push r29
        ; ...use r28 and r29 freely...
        pop  r29          ; restore them, in reverse order
        pop  r28
        ret
```

## The calling convention

So that separately compiled functions can call each other, avr-gcc follows a fixed set of rules called the **calling convention**. It says which registers carry each **argument** (a value passed into a function, filling one of its parameters):

| Registers | Role |
|---|---|
| R24, R25 | First argument (R24 alone for a byte); return value |
| R22, R23 | Second argument |
| R20, R21 … R8 | Further arguments, working downward |
| R18–R27, R30, R31 | The called function may change these freely |
| R2–R17, R28, R29 | The called function must save and restore these if it uses them |
| R1 | Always zero |
| R0 | Scratch: free for any temporary use |

A 4-byte argument such as an `unsigned long` takes a whole group: `delay(500)` passes 500 in R22 (lowest byte) to R25 (highest byte).

## Interrupts are surprise calls

An interrupt is a `CALL` the hardware makes on its own: it pushes the PC and jumps to the interrupt's slot in the vector table. Since it can happen between any two instructions, the ISR must save and restore every register it touches, *including SREG*, and finish with `RETI`, which also re-enables interrupts.

## Key ideas

- RJMP and branches use short relative offsets; JMP reaches anywhere.
- CALL pushes a 2-byte return address and jumps; RET pops it back into the PC.
- The stack grows down from 0x08FF, and nested calls unwind last-in, first-out.
- avr-gcc passes arguments starting in R24/R25 and returns values in R24/R25.

```quiz
Q: SP is 0x08FF. A CALL runs. What is SP afterwards?
- [ ] 0x0900
- [ ] 0x08FE
- [x] 0x08FD
- [ ] 0x08FF
= CALL pushes a 2-byte return address, and each push lowers SP by one, so SP goes from 0x08FF to 0x08FD.

Q: A function takes one byte argument. Which register does avr-gcc pass it in?
- [ ] R0
- [ ] R16
- [x] R24
- [ ] R31
= The first argument goes in R24 (with R25 too, if it is 2 bytes). Return values come back in the same registers.

Q: Why must an ISR save SREG, when an ordinary function doesn't have to?
- [ ] SREG holds the return address
- [x] The interrupt can land between a compare and its branch, and changing the flags would break that branch
- [ ] ISRs can't use registers
- [ ] SREG is cleared by every interrupt
= Ordinary code expects flags to survive from one instruction to the next. An interrupt can strike at any moment, so the ISR must leave SREG exactly as it found it.
```
