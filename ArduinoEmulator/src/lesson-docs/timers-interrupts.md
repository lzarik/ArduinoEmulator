`millis()` keeps counting while your code is stuck inside a `delay()` or a long loop. Nothing in your sketch updates it, so something else must. That something is a **hardware timer** and an **interrupt**.

## Timers count on their own

A **timer** is a counter built into the chip that ticks along by itself, driven by the clock, while the CPU gets on with your program. The ATmega328P has three: Timer0, Timer1 and Timer2. The Arduino core uses **Timer0** for timekeeping.

Timer0 is 8 bits wide, so its count register (`TCNT0`, the register holding its current count) goes 0, 1, 2 … 255 and then **overflows** back to 0. Counting at the full 16 MHz would overflow every 16 **microseconds** (millionths of a second, written µs), which is too fast to be useful. So a **prescaler** slows it down: a divider that lets the timer count up only once every so many clock ticks. Arduino's `init()` sets it to 64:

```text
16,000,000 ÷ 64       = 250,000 ticks per second  (one every 4 µs)
256 ticks × 4 µs      = 1.024 ms per overflow
```

So Timer0 overflows just a little slower than once per millisecond.

## Interrupts

Counting alone isn't enough; something has to notice each overflow. The chip can **interrupt** the CPU when it happens. When an interrupt **fires** (happens):

1. The CPU finishes the instruction it is on.
2. It pushes the current PC onto the stack, so it can come back.
3. It clears the **I** flag in SREG, so another interrupt can't barge in. (A **flag** is a single on/off bit; SREG, the status register, holds eight of them, and the I flag decides whether interrupts are allowed.)
4. It jumps to that interrupt's slot in the **interrupt vector table** at the start of flash. For the Timer0 overflow, that is word address `0x0020` (counted in 2-byte words, like the program counter).
5. The slot holds a jump to the **interrupt service routine (ISR)**: a function that handles the event.
6. The ISR ends with `RETI` (return from interrupt), which pops the PC and sets the I flag again.

Your program carries on exactly where it was, never knowing it was interrupted.

## How millis() works

The Arduino core's Timer0 overflow ISR adds 1.024 ms to a running total on every overflow (carrying the extra fraction so it never drifts). `millis()` just returns that total. `delay()` watches the time go by until enough has passed.

Simplified, the core's code looks like this:

```cpp
volatile unsigned long timer0_millis = 0;

// Runs every time Timer0 overflows: about once a millisecond
ISR(TIMER0_OVF_vect)
{
  timer0_millis++;   // the real code also adds up the extra 0.024 ms
}

unsigned long millis()
{
  noInterrupts();                   // stop the ISR changing it mid-copy
  unsigned long m = timer0_millis;
  interrupts();
  return m;
}
```

`ISR(TIMER0_OVF_vect)` is how you write an interrupt handler: the compiler places its address in the Timer0 overflow slot of the vector table, and ends it with `RETI` instead of `RET` (the ordinary return-from-function instruction). You can't add this exact handler to a sketch yourself, because the core already owns it and each interrupt can only have one handler. But every timer ISR you write later will have this shape.

## volatile and atomic reads

An **atomic** operation is one that happens in one piece, with no chance of being interrupted halfway. Two tools help with that:

- **`volatile`** tells the compiler the variable can change at any moment (because an ISR changes it), so it must re-read it from memory every time instead of keeping a copy in a register.
- **`noInterrupts()` and `interrupts()`** (the `CLI` and `SEI` instructions) briefly block interrupts while `millis()` copies the 4-byte total. Without them, an interrupt could land halfway through the copy and you would get two halves of different numbers.

> [!NOTE]
> Ohmster emulates Timer0 and its overflow interrupt, so `millis()` and `delay()` run on real emulated hardware. Step through a `delay()` one instruction at a time and you will see the CPU jump into the ISR every 1.024 ms of emulated time.

## Key ideas

- A timer is a hardware counter that runs without the CPU. Timer0 overflows every 1.024 ms on an Uno.
- An interrupt makes the CPU save its place, run an ISR, and return with RETI.
- The interrupt vector table at the start of flash says where each ISR is.
- `millis()` is a total kept up to date by Timer0's overflow ISR.
- Variables shared with an ISR must be `volatile`, and multi-byte reads should be protected.

```quiz
Q: With a prescaler of 64 on a 16 MHz clock, how often does 8-bit Timer0 overflow?
- [ ] Every 64 µs
- [ ] Every 1 second
- [x] About every 1.024 ms
- [ ] Every 16 µs
= 16 MHz ÷ 64 = 250,000 ticks per second, or 4 µs per tick. 256 ticks × 4 µs = 1.024 ms.

Q: What is the first thing the CPU does when an interrupt fires in the middle of an instruction?
- [ ] Abandons the instruction immediately
- [x] Finishes the current instruction
- [ ] Restarts the program
- [ ] Waits for loop() to end
= The CPU always completes the current instruction, then saves the PC and jumps to the interrupt vector.

Q: Why must a variable shared with an ISR be declared volatile?
- [ ] To store it in flash
- [ ] To make it faster
- [x] So the compiler re-reads it every time instead of using a stale copy in a register
- [ ] So it can hold negative numbers
= Without volatile, the compiler may assume nothing else changes the variable and keep reusing an old value.
```
