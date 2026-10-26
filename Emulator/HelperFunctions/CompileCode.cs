using System.Diagnostics;

namespace Emulator;

public class CompileCode
{
    public sealed record CompileArtifacts(string HexText, byte[] ElfBytes, string ElfFilePath, string SketchFilePath);

    /// <param name="onProgress">Receives arduino-cli's progress lines (e.g. "Compiling core...") as they happen.</param>
    public CompileArtifacts CompileSketch(string sourceCode, Action<string>? onProgress = null)
    {
        if (string.IsNullOrWhiteSpace(sourceCode))
        {
            throw new ArgumentException("sourceCode cannot be empty.", nameof(sourceCode));
        }

        var tempRoot = Path.Combine(Path.GetTempPath(), "arduino-emulator-build", Guid.NewGuid().ToString("N"));
        var sketchName = "GeneratedSketch";
        var sketchDirectory = Path.Combine(tempRoot, sketchName);
        var outputDirectory = Path.Combine(tempRoot, "build");

        Directory.CreateDirectory(sketchDirectory);
        Directory.CreateDirectory(outputDirectory);

        var inoPath = Path.Combine(sketchDirectory, $"{sketchName}.ino");
        File.WriteAllText(inoPath, sourceCode);

        var arduinoCliPath = ResolveArduinoCliPath();

        // --verbose makes arduino-cli announce each build step, which is forwarded as progress.
        var compileResult = RunCommand(
            arduinoCliPath,
            $"compile --fqbn arduino:avr:uno {(onProgress != null ? "--verbose " : "")}--output-dir \"{outputDirectory}\" \"{sketchDirectory}\"",
            onProgress == null ? null : line => { if (IsProgressLine(line)) onProgress(line.Trim()); });

        if (compileResult.ExitCode != 0)
        {
            var details = !string.IsNullOrWhiteSpace(compileResult.StandardError)
                ? compileResult.StandardError
                : compileResult.StandardOutput;

            throw new InvalidOperationException(
                $"Arduino compilation failed.\n{details}".Trim());
        }

        var hexFilePath = Directory
            .EnumerateFiles(outputDirectory, "*.hex", SearchOption.AllDirectories)
            .FirstOrDefault(path => !path.EndsWith("with_bootloader.hex", StringComparison.OrdinalIgnoreCase))
            ?? Directory.EnumerateFiles(outputDirectory, "*.hex", SearchOption.AllDirectories).FirstOrDefault();

        if (hexFilePath is null)
        {
            throw new FileNotFoundException("No .hex file was produced by arduino-cli.");
        }

        var elfFilePath = Directory
            .EnumerateFiles(outputDirectory, "*.elf", SearchOption.AllDirectories)
            .FirstOrDefault();

        if (elfFilePath is null)
        {
            throw new FileNotFoundException("No .elf file was produced by arduino-cli.");
        }

        return new CompileArtifacts(
            File.ReadAllText(hexFilePath),
            File.ReadAllBytes(elfFilePath),
            elfFilePath,
            inoPath);
    }

    public string ReturnHexFile(string sourceCode)
    {
        return CompileSketch(sourceCode).HexText;
    }

    private static string ResolveArduinoCliPath()
    {
        var candidates = new List<string>
        {
            "/opt/homebrew/bin/arduino-cli",
            "/usr/local/bin/arduino-cli"
        };

        var pathEnvironment = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
        var pathSegments = pathEnvironment
            .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        foreach (var segment in pathSegments)
        {
            var combined = Path.Combine(segment, "arduino-cli");
            candidates.Add(combined);
        }

        foreach (var candidate in candidates)
        {
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }

        throw new FileNotFoundException(
            "Could not find 'arduino-cli'. Install it and ensure it is available in PATH (or at /opt/homebrew/bin/arduino-cli). " +
            $"Current PATH: '{pathEnvironment}'.");
    }

    // Verbose output is mostly long compiler command lines; keep the human-readable step announcements.
    private static bool IsProgressLine(string line)
    {
        var text = line.Trim();
        if (text.Length == 0 || text.Length > 120 || text.Contains('/') || text.Contains('\\')) return false;
        return text.EndsWith("...") || text.StartsWith("Sketch uses") || text.StartsWith("Global variables use") || text.StartsWith("Using ");
    }

    private static CommandResult RunCommand(string fileName, string arguments, Action<string>? onLine = null)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = fileName,
            Arguments = arguments,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        Process? process;
        try
        {
            process = Process.Start(startInfo);
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException(
                $"Failed to start process '{fileName}' with args '{arguments}'.", ex);
        }

        if (process is null)
        {
            throw new InvalidOperationException($"Could not start process '{fileName}'.");
        }

        using (process)
        {
            // Read both streams concurrently, line by line, so progress can be reported as it happens.
            var stdoutBuilder = new System.Text.StringBuilder();
            var stderrTask = process.StandardError.ReadToEndAsync();
            string? line;
            while ((line = process.StandardOutput.ReadLine()) != null)
            {
                stdoutBuilder.AppendLine(line);
                onLine?.Invoke(line);
            }
            var stderr = stderrTask.Result;
            process.WaitForExit();
            var stdout = stdoutBuilder.ToString();

            if (!string.IsNullOrWhiteSpace(stdout))
            {
                Console.WriteLine($"{fileName} stdout:\n{stdout}");
            }

            if (!string.IsNullOrWhiteSpace(stderr))
            {
                Console.WriteLine($"{fileName} stderr:\n{stderr}");
            }

            return new CommandResult(process.ExitCode, stdout, stderr);
        }
    }

    private sealed record CommandResult(int ExitCode, string StandardOutput, string StandardError);
}