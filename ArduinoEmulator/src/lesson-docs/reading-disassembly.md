This is where everything meets. You will take the Blink sketch from the very first lesson and follow it all the way down to the instructions the CPU runs, using what you have learned about registers, encoding, flags, calls and the stack.

## The sketch

```cpp try
void setup()
{
  pinMode(13, OUTPUT);
}

void loop()
{
  digitalWrite(13, HIGH);
  delay(500);
  digitalWrite(13, LOW);
  delay(500);
}
```

Open it in the editor and compile it, but don't run it yet.

## What the compiler produced

Here is the heart of Blink after compiling, written as assembly, exactly as avr-gcc built it for the Uno. Turning machine code back into assembly like this is called **disassembly**. The addresses on the left are byte addresses in flash, and `.-24` means "jump back 24 bytes from here".

```asm
037a:   ldi   r24, 0x01            ; val = HIGH
037c:   call  digitalWrite.constprop.0
0380:   call  delay.constprop.1
0384:   ldi   r24, 0x00            ; val = LOW
0386:   call  digitalWrite.constprop.0
038a:   call  delay.constprop.1
038e:   sbiw  r28, 0x00            ; is there a serialEventRun function?
0390:   breq  .-24                 ; no: back to 037a, run loop() again
0392:   call  serialEventRun
0396:   rjmp  .-30                 ; back to 037a
```

Some of this is exactly what you would expect, and some of it is the compiler being clever.

### The expected part

- `ldi r24, 0x01` puts the argument `HIGH` in **R24**, where the calling convention says the first argument goes.
- `call` pushes the return address and jumps to the function.
- After the second `delay`, a branch goes back to the top. That is the `for (;;)` in the hidden `main()` from *setup() and loop()*.

### The clever part

**Where are setup() and loop()?** Arduino builds with *link-time optimization*, which lets the compiler see the whole program at once. Since `setup()` and `loop()` are each called from one place, it pasted their code straight into `main()` (this is called **inlining**) and saved a call and return on every pass.

**Where did the pin number go?** Every `digitalWrite` in this sketch uses pin 13, and every `delay` uses 500. So the compiler made special copies of both functions with those values built in. That's what `.constprop` (**constant propagation**: spotting values that never change and building them in) means in their names. `digitalWrite.constprop.0` only needs the value, in R24, and `delay.constprop.1` needs no arguments at all. In a sketch that called them with different values, you would see the full calling convention: the pin in R24 and the value in R22 for `digitalWrite`, and the 4-byte time in R22 to R25 for `delay`.

**What is sbiw r28 for?** The real `main()` does one more thing on every pass: `if (serialEventRun) serialEventRun();`. R28:R29 holds that function's address, which is 0 because this sketch doesn't use Serial (the USB text connection from *A Tour of the Board*). `SBIW r28, 0` (subtract from a register pair) subtracts zero just to set the Z flag, and `BREQ` skips the call when the address is zero.

> [!NOTE]
> Your build may not match these addresses exactly, since a different sketch or compiler version moves things around. The debugger's Program list shows exactly what yours compiled to, with each instruction matched to its line in your sketch.

## Inside digitalWrite

Follow the call into `digitalWrite.constprop.0` and you will find:

1. Three `LPM` (load from program memory) instructions read **lookup tables** stored in flash (lists of facts about each pin, looked up by pin number): which timer pin 13 uses, its bit mask (`0x20`, bit 5), and which port it is on.
2. A series of compares and branches checks whether a PWM timer needs switching off first.
3. `IN r18, 0x3F` saves SREG, and `CLI` turns off interrupts.
4. `LD` reads PORTB, the bit is set or cleared, and `ST` writes it back. **This is the instruction that changes the pin.**
5. `OUT 0x3F, r18` restores SREG (and with it, interrupts), and `RET` returns.

That is around 30 instructions to change one bit, and nearly every idea from this course shows up in them: lookup tables in flash, compares and branches, SREG, interrupts and I/O registers.

## Step through it

Set the speed to **Instruction**, or use **Step**, and watch the debugger as you go:

1. **Before the first call**, R24 becomes `0x01`. That's the argument.
2. **On the call**, the PC jumps away and **SP drops by 2**: the return address was pushed.
3. **Inside digitalWrite**, watch for the `ST` that writes PORTB. Bit 5 of PORTB turns on in the I/O ports table, and the LED on the bench lights at exactly that instruction.
4. **On its RET**, SP goes back up by 2 and the PC lands just after the call.
5. **Inside delay**, the CPU loops, reading the time and comparing again and again. Every 1.024 ms of emulated time, the Timer0 overflow interrupt pushes the PC and runs its ISR.

## The register-level version

Now compile the version from *I/O Ports*:

```cpp try
void setup()
{
  DDRB |= (1 << 5);
}

void loop()
{
  PORTB |= (1 << 5);
  delay(500);
  PORTB &= ~(1 << 5);
  delay(500);
}
```

`DDRB |= (1 << 5)` becomes `SBI 0x04, 5`, and the two PORTB lines become `SBI 0x05, 5` and `CBI 0x05, 5`. One instruction each, two cycles each, encoded as `0x9A2D` and `0x982D`. All the work `digitalWrite` does before reaching the same bit is gone.

## How far you've come

You started by making an LED blink. Along the way you learned how current and resistors keep that LED alive, how a sketch is structured, and how timing and decisions work. Then you went inside the chip: ports and registers, timers and interrupts, and finally the instruction set itself. You can now follow a single line of C++ through the compiler, into flash, through fetch and decode, and out of a pin as a voltage that lights an LED.

That chain, from software to instructions to hardware, is what computer engineering is about.

## Key ideas

- Each call compiles to argument loads (starting in R24) followed by CALL.
- CALL lowers SP by 2 and RET raises it again; you can watch it happen in the debugger.
- The compiler inlines small functions and builds specialized copies when arguments never change.
- digitalWrite takes around 30 instructions; a direct register write is a single SBI or CBI.

```quiz
Q: In the compiled Blink, which register carries HIGH or LOW into digitalWrite.constprop.0?
- [ ] R22
- [x] R24
- [ ] R13
- [ ] R0
= It is the function's first (and only) argument, and avr-gcc passes the first argument in R24.

Q: Why does the compiled Blink never load the number 13 before calling digitalWrite?
- [ ] Pin 13 is the default for digitalWrite
- [x] Every call used pin 13, so the compiler made a copy of digitalWrite with 13 built in
- [ ] The pin number is stored in SREG
- [ ] digitalWrite doesn't need a pin number
= That's constant propagation. Since the argument never changes, passing it would be wasted work, so the specialized copy (digitalWrite.constprop.0) has it built in.

Q: A sketch calls delay(500) with the normal calling convention. What does R22 hold at the call?
- [ ] 0x01
- [ ] 0x00
- [x] 0xF4
- [ ] 0x05
= 500 is 0x000001F4. A 4-byte argument goes in R22 to R25 with the lowest byte first, so R22 = 0xF4 and R23 = 0x01.
```
