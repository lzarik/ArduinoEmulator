Every sketch has `setup()` and `loop()`, but where do they come from, and why does `loop()` never stop? This lesson looks at how an Arduino program is put together.

## There is a main() after all

In C++, every program starts in a function called `main()`. Sketches seem to skip it, but it's there: the **Arduino core** supplies one for you. (A **library** is ready-made code you can use in your programs, and the Arduino core is the library that comes with every sketch.) Simplified, it looks like this:

```cpp
int main()
{
  init();        // get the chip's timers going, so millis() and delay() work

  setup();       // your code, once

  for (;;) {     // a loop with no exit
    loop();      // your code, forever
  }
}
```

Anything after `//` on a line is a **comment**: a note for humans that the chip ignores. A **loop** is code that repeats, and `for (;;)` is a loop with no condition for stopping, so it never ends. That is why `loop()` runs forever. Your laptop has an **operating system** (like Windows or macOS) that a finished program goes back to, but a microcontroller has nothing like that, so a program that "finished" would have nowhere to go.

## What goes where

| Put it in setup() | Put it in loop() |
|---|---|
| `pinMode` calls | Reading inputs |
| Starting values | Making decisions |
| Anything done once | Updating outputs |

## Variables between loops

A **variable** is a named box that holds a value, like a counter. **Declaring** a variable means creating it: `int count = 0;` makes a box called `count` that holds whole numbers (`int` is short for integer) and puts 0 in it.

Each time `loop()` runs (each **pass**), it starts fresh. A variable declared *inside* it is created and thrown away on every pass. A variable declared *outside* any function, a **global**, keeps its value between passes.

This sketch blinks exactly five times and then stops, because `count` survives from one pass of `loop()` to the next:

```cpp try
int count = 0;   // global: keeps its value between loops

void setup()
{
  pinMode(13, OUTPUT);
}

void loop()
{
  if (count < 5) {
    digitalWrite(13, HIGH);
    delay(300);
    digitalWrite(13, LOW);
    delay(300);
    count = count + 1;
  }
}
```

`if (count < 5)` runs the code in its braces only when the **condition** in the brackets is true, here "count is less than 5". `count = count + 1` adds one to the count. After the fifth blink `loop()` still runs, millions of times a second, but the condition is false so it does nothing. The chip never stops running; it just has nothing left to do.

> [!WARNING]
> If you moved `int count = 0;` inside `loop()`, it would be reset to 0 on every pass and the LED would blink forever. Where a variable is declared decides how long it lives.

## Key ideas

- The Arduino core provides `main()`, which calls `setup()` once and `loop()` forever.
- A microcontroller program never ends; there is nothing to return to.
- Globals keep their values between passes of `loop()`. Variables declared inside `loop()` start over each time.

```quiz
Q: Why does loop() run forever?
- [ ] Because the Arduino has a timer that restarts it
- [x] Because the hidden main() calls it inside a loop that never exits
- [ ] Because it is a special C++ keyword
- [ ] It doesn't, it runs 1000 times
= The core's main() calls loop() inside for (;;), an endless loop. There is no operating system for the program to return to.

Q: A variable is declared inside loop(). What happens to its value at the end of each pass?
- [ ] It is saved to flash
- [x] It is thrown away, and the variable starts over on the next pass
- [ ] It is copied to a global
- [ ] Nothing, it keeps its value
= Variables declared inside a function only live while that function runs. Use a global to remember a value between passes.
```
