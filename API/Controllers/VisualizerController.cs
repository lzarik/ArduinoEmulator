using Microsoft.AspNetCore.Mvc;
using Emulator;
using System.Globalization;
using System.Text.Json;
using SharedDomainTypes;

namespace API.Controllers;

[ApiController]
[Route("[controller]")]
public class VisualizerController : ControllerBase
{
    public sealed record CompileCodeResponse(string? HexText, string? ElfBase64, List<CommandInformation> Instructions, List<string> Errors);

    [HttpPost("FindAllInstructions")]
    public IActionResult FindAllInstructions([FromBody] string[] dataLines)
    {
        FindInstruction find = new FindInstruction();
    
        string serializedJson = JsonSerializer.Serialize(find.FindAllCommands(dataLines));

        return Ok(serializedJson);
    }

    [HttpPost("RunInstruction")]
    public MachineData.Diff RunInstruction([FromBody] MachineData state)
    {   
        Parse parse = new Parse();

        return parse.ParseCommand(state);
    }

    /// <summary>
    /// Same as CompileCode, but streams progress as newline-delimited JSON while it works:
    /// {"type":"stage","stage":"build|decode|map","message":...}, {"type":"log","message":...} for
    /// arduino-cli's step announcements, and finally {"type":"result", ...CompileCodeResponse}.
    /// </summary>
    [HttpPost("CompileCodeStream")]
    public async Task CompileCodeStream([FromBody] string sourceCode)
    {
        Response.ContentType = "application/x-ndjson";
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        var writeLock = new SemaphoreSlim(1, 1);

        async Task Send(object payload)
        {
            await writeLock.WaitAsync();
            try
            {
                await Response.WriteAsync(JsonSerializer.Serialize(payload, options) + "\n");
                await Response.Body.FlushAsync();
            }
            finally { writeLock.Release(); }
        }

        CompileCodeResponse result;
        try
        {
            await Send(new { type = "stage", stage = "build", message = "Building the sketch with arduino-cli" });
            var artifacts = await Task.Run(() => new CompileCode().CompileSketch(
                sourceCode,
                line => Send(new { type = "log", message = line }).GetAwaiter().GetResult()));

            var dataLines = ExtractInstructionDataLines(artifacts.HexText);
            await Send(new { type = "stage", stage = "decode", message = "Decoding instructions from the hex file" });
            var instructions = new FindInstruction().FindAllCommands(dataLines);

            await Send(new { type = "stage", stage = "map", message = $"Matching {instructions.Count} instructions to lines in your sketch" });
            try
            {
                await Task.Run(() => ElfSourceLineResolver.ApplySourceLines(
                    artifacts.ElfFilePath, artifacts.SketchFilePath, CountSourceLines(sourceCode), instructions));
            }
            catch (Exception resolveEx)
            {
                Console.WriteLine($"ELF source-line mapping unavailable: {resolveEx.Message}");
            }

            result = new CompileCodeResponse(artifacts.HexText, Convert.ToBase64String(artifacts.ElfBytes), instructions, []);
        }
        catch (Exception ex)
        {
            var errors = ex.Message
                .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(message => !string.IsNullOrWhiteSpace(message))
                .ToList();
            result = new CompileCodeResponse(null, null, [], errors.Count > 0 ? errors : ["Arduino compilation failed."]);
        }

        await Send(new { type = "result", result.HexText, result.ElfBase64, result.Instructions, result.Errors });
    }

    [HttpPost("CompileCode")]
    public ActionResult<CompileCodeResponse> CompileCode([FromBody] string sourceCode)
    {
        try
        {
            CompileCode compile = new CompileCode();
            var artifacts = compile.CompileSketch(sourceCode);
            var find = new FindInstruction();
            var instructions = find.FindAllCommands(ExtractInstructionDataLines(artifacts.HexText));
            var sourceLineCount = CountSourceLines(sourceCode);

            try
            {
                ElfSourceLineResolver.ApplySourceLines(
                    artifacts.ElfFilePath,
                    artifacts.SketchFilePath,
                    sourceLineCount,
                    instructions);
            }
            catch (Exception resolveEx)
            {
                Console.WriteLine($"ELF source-line mapping unavailable: {resolveEx.Message}");
            }

            var elfBase64 = Convert.ToBase64String(artifacts.ElfBytes);
            return Ok(new CompileCodeResponse(artifacts.HexText, elfBase64, instructions, []));
        }
        catch (Exception ex)
        {
            var errorMessages = ex.Message
                .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(message => !string.IsNullOrWhiteSpace(message))
                .ToList();

            if (errorMessages.Count == 0)
            {
                errorMessages.Add("Arduino compilation failed.");
            }

            return Ok(new CompileCodeResponse(null, null, [], errorMessages));
        }
    }

    private static string[] ExtractInstructionDataLines(string hexText)
    {
        var lines = hexText.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var dataLines = new List<string>();

        foreach (var rawLine in lines)
        {
            var line = rawLine.Trim();
            if (line.Length < 11 || !line.StartsWith(':'))
            {
                continue;
            }

            var dataCount = ParseHexByte(line.AsSpan(1, 2));
            var recordType = ParseHexByte(line.AsSpan(7, 2));

            if (recordType != 0 || dataCount <= 0)
            {
                continue;
            }

            var dataLength = dataCount * 2;
            if (line.Length < 9 + dataLength)
            {
                continue;
            }

            dataLines.Add(line.Substring(9, dataLength));
        }

        return dataLines.ToArray();
    }

    private static byte ParseHexByte(ReadOnlySpan<char> twoHexDigits)
    {
        return byte.TryParse(twoHexDigits, NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : (byte)0;
    }

    private static int CountSourceLines(string sourceCode)
    {
        if (string.IsNullOrEmpty(sourceCode))
        {
            return 0;
        }

        return sourceCode.Replace("\r\n", "\n", StringComparison.Ordinal).Split('\n').Length;
    }
} 