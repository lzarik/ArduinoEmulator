Every Arduino journey starts the same way: making an LED blink. It sounds small, but it touches everything: writing code, compiling it, running it on the chip, and seeing the chip change the real world.

## The sketch

An Arduino program is called a **sketch**. Sketches are written in **C++**, a popular programming language. Here is Blink:

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

Press **Open in editor** above to load it, then press **Run**. The L LED on the board, and the LED wired to pin 13 on the breadboard, blink once a second.

## Line by line

First, one new idea: a **function** is a named chunk of code that does one job. The code between its curly braces `{ }` is what it does. Some functions you write yourself, like `setup` and `loop` here; others come ready-made, like `pinMode` and `digitalWrite`. To use (or **call**) a function, you write its name followed by brackets, and put any information it needs inside the brackets.

`void setup()` is a function that runs **once**, when the board starts. Anything that only needs doing once goes here. (`void` just means the function doesn't hand back an answer; you'll see why that matters in *Functions*.)

`pinMode(13, OUTPUT);` tells the chip that pin 13 is an **output**: the chip will **drive** it (set its voltage itself), rather than listen to it. Pins start out as **inputs**, which only listen, so this line is essential.

`void loop()` is a function that runs **again and again, forever**, right after `setup()` finishes.

`digitalWrite(13, HIGH);` sets pin 13 to **HIGH**, 5 volts. **Current** (electricity moving through a wire) flows through the LED and it lights.

`delay(500);` pauses the program for 500 **milliseconds** (half a second). The LED stays on while the chip waits.

`digitalWrite(13, LOW);` sets pin 13 to **LOW**, 0 volts. The LED turns off.

`delay(500);` waits another half second. Then `loop()` ends and immediately starts again.

> [!NOTE]
> Each instruction in your code is called a **statement**, and every statement ends with a semicolon `;`. Forgetting one is the most common **compile error** (a mistake that stops your code from being translated), and the error message will point at the line *after* the missing semicolon.

## What happened when you pressed Run

1. **Compile.** Your C++ was translated into machine code: instructions written in **binary** (all 0s and 1s), the only thing the ATmega328P understands. The status label at the top of the screen shows each stage as it happens.
2. **Load.** The machine code was placed in the emulated chip's flash memory.
3. **Run.** The emulated CPU started carrying out instructions from **address** 0 (every spot in memory has a number, called its address, and 0 is the very first one), at 16 million instructions per second, just like real hardware.

## Make it yours

Change the numbers and run it again:

- Make it blink faster: try `delay(100)`.
- Make a heartbeat: two quick blinks, then a pause.
- Make it stay on longer than it stays off.

```cpp try
void setup()
{
  pinMode(13, OUTPUT);
}

// Two quick flashes, then a longer pause, like a heartbeat
void loop()
{
  digitalWrite(13, HIGH);
  delay(100);
  digitalWrite(13, LOW);
  delay(100);
  digitalWrite(13, HIGH);
  delay(100);
  digitalWrite(13, LOW);
  delay(700);
}
```

## Key ideas

- `setup()` runs once at power-up. `loop()` runs forever after.
- `pinMode(pin, OUTPUT)` makes a pin an output.
- `digitalWrite(pin, HIGH)` gives 5 V, `digitalWrite(pin, LOW)` gives 0 V.
- `delay(ms)` waits that many milliseconds.

```quiz
Q: What does delay(500) do?
- [ ] Waits 500 seconds
- [x] Waits half a second
- [ ] Blinks the LED 500 times
- [ ] Runs loop() 500 times
= delay takes milliseconds, and 500 milliseconds is half a second.

Q: How many times does the code inside setup() run?
- [x] Once, when the board starts
- [ ] Forever
- [ ] Every 500 milliseconds
- [ ] Once per loop()
= setup() runs a single time at power-up or reset. loop() is the part that repeats.

Q: You delete the pinMode line and run Blink again. What happens to the LED?
- [ ] It blinks exactly the same
- [ ] The sketch fails to compile
- [x] It barely glows, because pin 13 is still an input
- [ ] The board resets
= Pins start as inputs. On the ATmega328P, writing HIGH to an input turns on a weak internal pull-up resistor instead of driving the pin, so only a trickle of current reaches the LED.
```
