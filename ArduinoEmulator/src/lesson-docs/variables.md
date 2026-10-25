A variable is a named place in memory that holds a value. On a laptop you rarely think about how big that place is. On a chip with 2 KB of memory and an 8-bit CPU, it matters a lot.

## Declaring a variable

```cpp
int count = 0;
```

This says: set aside room for an `int` (an **integer**, meaning a whole number with no decimal point), call it `count`, and start it at 0. The **type** (`int`) decides how much memory the variable uses and what values it can hold.

## Types on the Uno

| Type | Size | Range | Use it for |
|---|---|---|---|
| `bool` | 1 byte | `true` or `false` | On/off flags |
| `byte` (or `uint8_t`) | 1 byte | 0 to 255 | Small counts, pin numbers, raw data |
| `char` | 1 byte | −128 to 127 | Text characters |
| `int` | 2 bytes | −32,768 to 32,767 | General whole numbers |
| `unsigned int` | 2 bytes | 0 to 65,535 | Whole numbers that are never negative |
| `long` | 4 bytes | about ±2.1 billion | Big numbers |
| `unsigned long` | 4 bytes | 0 to about 4.29 billion | Time in milliseconds |
| `float` | 4 bytes | about ±3.4 × 10³⁸, 6 to 7 digits | Numbers with decimals |

Reading the table: a **flag** is a true/false marker, like "has the button been pressed?". **Unsigned** types give up negative numbers so they can count twice as high. And 3.4 × 10³⁸ is an enormous number (34 followed by 37 zeros), though a `float` only keeps its first 6 or 7 digits exactly.

> [!WARNING]
> On the Uno an `int` is only **2 bytes**, so it tops out at 32,767. On most computers (and on many other boards) an `int` is 4 bytes. Code that counts milliseconds in an `int` breaks after about 33 seconds.

## Overflow

When a value goes past the top of its range, it **overflows**: it wraps around to the bottom, like a car's mileage counter rolling over from 999999 to 000000:

```cpp
byte b = 255;
b = b + 1;    // b is now 0

int n = 32767;
n = n + 1;    // n is now -32768
```

There is no error and no warning while the program runs. The number just wraps. Choosing a type big enough for every value it will hold is your job.

## Why size matters here

**Memory.** The Uno has 2048 bytes of SRAM for all your variables, plus the **stack** (a work area the chip uses when it runs functions; *Registers and Memory* explains it). An **array** (a list of values stored together) of 500 `long`s would use all of it.

**Speed.** The ATmega328P is an **8-bit** CPU: it works on one byte at a time. Adding two `byte`s is one instruction. Adding two `int`s takes two: an `int`'s two bytes are its low half and its high half, and the chip adds the low halves first, then the high halves plus the **carry**, just like adding two-digit numbers column by column and carrying the 1. Adding two `long`s takes four. And the chip has no circuitry for decimal maths at all, so every `float` calculation runs a small program of its own that takes dozens or hundreds of instructions.

You will see this for yourself in the last unit, when you read the machine-code instructions the compiler produces.

## const

If a value never changes, mark it `const`:

```cpp
const int ledPin = 13;
```

The compiler will refuse to let anything change it, and it can often replace it with the number itself so it uses no memory at all. Using names like `ledPin` instead of bare `13` also makes code much easier to read and change.

## Key ideas

- A variable's type decides its size and range.
- On the Uno, `int` is 2 bytes (−32,768 to 32,767). Use `unsigned long` for milliseconds.
- Values that pass the end of their range wrap around silently.
- Smaller types use less memory and fewer instructions on an 8-bit CPU.

```quiz
Q: What is the largest value an int can hold on an Arduino Uno?
- [ ] 255
- [x] 32,767
- [ ] 65,535
- [ ] 2,147,483,647
= An int on the Uno is 16 bits, signed, so it ranges from −32,768 to 32,767.

Q: A byte variable holds 255. What does it hold after adding 1?
- [ ] 256
- [x] 0
- [ ] 255
- [ ] The program stops with an error
= A byte only has 8 bits (0 to 255), so 255 + 1 wraps around to 0.

Q: Why does adding two long variables take more instructions than adding two bytes?
- [ ] Because long is a slower word to type
- [x] The 8-bit CPU adds one byte at a time, and a long is four bytes
- [ ] Because longs are stored in flash
- [ ] It doesn't, they take the same time
= The ATmega328P's ALU works on 8 bits, so a 4-byte addition is done as four 1-byte additions, passing the carry along.
```
