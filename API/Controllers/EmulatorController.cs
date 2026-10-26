using Microsoft.AspNetCore.Mvc;
using Emulator;

namespace API.Controllers;

// Runs a loaded program on the server-side emulator. The machine lives in a single AvrSession
// (registered as a singleton), so this is one emulator shared by whoever is using the local API.
[ApiController]
[Route("[controller]")]
public class EmulatorController(AvrSession session) : ControllerBase
{
    public sealed record RunRequest(long Cycles, PinInputs? Inputs);
    public sealed record StartRequest(double Speed, PinInputs? Inputs);

    [HttpPost("Load")]
    public EmulatorState Load([FromBody] string[] dataLines) => session.Load(dataLines);

    [HttpPost("Reset")]
    public EmulatorState Reset() => session.Reset();

    [HttpPost("Step")]
    public EmulatorState Step([FromBody] RunRequest request) => session.Step(request.Inputs);

    /// <summary>Runs up to request.Cycles clock cycles (16,000 per emulated millisecond).</summary>
    [HttpPost("Run")]
    public EmulatorState Run([FromBody] RunRequest request) => session.Run(Math.Clamp(request.Cycles, 0, 160_000_000), request.Inputs);

    /// <summary>Runs the program in the background at Speed × real time; calling it again changes the speed.</summary>
    [HttpPost("Start")]
    public EmulatorState Start([FromBody] StartRequest request) => session.Start(request.Speed, request.Inputs);

    /// <summary>The latest snapshot of a background run, passing in the breadboard's inputs.</summary>
    [HttpPost("Poll")]
    public EmulatorState Poll([FromBody] PinInputs? inputs) => session.Poll(inputs);

    [HttpPost("Stop")]
    public EmulatorState Stop() => session.Stop();
}
