`digitalWrite(13, HIGH)` feels like magic the first time. In this lesson the magic disappears: it comes down to setting a single bit in a single register.

## Ports

The ATmega328P groups its pins into **ports** of up to eight pins: **Port B**, **Port C** and **Port D**. Each pin is one bit of its port. The 8 bits in a byte are numbered 0 to 7, starting from the right. Arduino pin numbers are friendly names for those bits:

| Arduino pins | Port bits |
|---|---|
| D0 to D7 | PD0 to PD7 (Port D, bits 0 to 7) |
| D8 to D13 | PB0 to PB5 (Port B, bits 0 to 5) |
| A0 to A5 | PC0 to PC5 (Port C, bits 0 to 5) |

So **pin 13 is Port B, bit 5**, written PB5.

## Three registers per port

Each port is controlled by three I/O registers. Each bit in them controls the matching pin (bit 5 controls the pin on bit 5, and so on).

| Register | Address | A 1 in bit n means |
|---|---|---|
| `DDRB` | `0x24` | Pin PBn is an output (Data Direction Register) |
| `PORTB` | `0x25` | Output: drive PBn HIGH. Input: turn on its pull-up. |
| `PINB` | `0x23` | Reading: PBn is currently HIGH |

Ports C and D work the same way: `PINC`, `DDRC`, `PORTC` at `0x26`–`0x28` and `PIND`, `DDRD`, `PORTD` at `0x29`–`0x2B`.

So `pinMode(13, OUTPUT)` sets bit 5 of DDRB to 1, and `digitalWrite(13, HIGH)` sets bit 5 of PORTB to 1. That is all they do in the end.

> [!TIP]
> Ohmster's debugger has an **I/O ports** table showing DDR, PORT and PIN for each port, bit by bit. Run Blink and watch bit 5 of PORTB flip on and off.

## Blink without the Arduino functions

You can write those registers yourself. The names `DDRB`, `PORTB` and `PINB` are already defined for you:

```cpp try
void setup()
{
  DDRB |= (1 << 5);     // pin 13 (PB5) is an output
}

void loop()
{
  PORTB |= (1 << 5);    // set bit 5: pin 13 HIGH
  delay(500);
  PORTB &= ~(1 << 5);   // clear bit 5: pin 13 LOW
  delay(500);
}
```

### The bit tricks

These lines use **bitwise operators**, which work on each bit of a byte separately:

- **OR** (`|`): the result bit is 1 if *either* bit is 1.
- **AND** (`&`): the result bit is 1 only if *both* bits are 1.
- **XOR** (`^`): the result bit is 1 if the two bits are *different*.
- **NOT** (`~`): flips every bit, 0 to 1 and 1 to 0.

And `x |= m` is shorthand for `x = x | m` (the same goes for `&=` and `^=`). Now the tricks:

- `1 << 5` is the number 1 **shifted** left five places (moved over, with zeros filling in behind): binary `00100000`, a **mask** with only bit 5 set. A mask picks out the bits you want to change.
- `PORTB |= mask` ORs the mask in. Bit 5 becomes 1 and every other bit stays as it was.
- `PORTB &= ~mask` ANDs with the inverted mask (`11011111`). Bit 5 becomes 0 and the rest stay put.
- `PORTB ^= mask` XORs it, flipping bit 5.

These three patterns (set, clear, toggle) appear in nearly all **low-level** code (code that works directly with the hardware).

## Why bother?

`digitalWrite` is convenient but does a lot of work. It looks up which port and bit the pin number means, checks whether a PWM timer is using the pin and switches it off, turns off interrupts while it changes the register, and finally writes it. That takes dozens of **clock cycles** (ticks of the chip's 16 MHz clock).

`PORTB |= (1 << 5);` compiles to a single instruction, `SBI 0x05, 5` ("set bit 5 in I/O register 5"), which takes 2 cycles. When timing is tight, writing registers directly can be many times faster.

> [!NOTE]
> Why 0x05 and not 0x25? `SBI` and `CBI` use **I/O addresses**, which count from the start of the I/O area. Data address 0x25 is I/O address 0x25 − 0x20 = 0x05.

## Key ideas

- Pins are grouped into ports B, C and D; each pin is one bit.
- Pin 13 is PB5: Port B, bit 5.
- DDRx sets direction, PORTx sets the output level (or pull-up), PINx reads the pins.
- `|= mask` sets a bit, `&= ~mask` clears it, `^= mask` toggles it.

```quiz
Q: Which port and bit is Arduino pin 8?
- [ ] PD0
- [x] PB0
- [ ] PC0
- [ ] PB8
= Pins 8 to 13 are Port B bits 0 to 5, so pin 8 is PB0.

Q: Which register decides whether a pin is an input or an output?
- [x] DDRx
- [ ] PORTx
- [ ] PINx
- [ ] SREG
= The Data Direction Register: a 1 makes the pin an output, a 0 makes it an input.

Q: PORTD holds binary 00001111. What does it hold after PORTD |= (1 << 7)?
- [ ] 10000000
- [x] 10001111
- [ ] 00001111
- [ ] 01111111
= 1 << 7 is 10000000. ORing it in sets bit 7 and leaves the other bits unchanged.
```
