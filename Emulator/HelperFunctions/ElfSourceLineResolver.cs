using System.Diagnostics;
using SharedDomainTypes;

namespace Emulator;

public static class ElfSourceLineResolver
{
    public static void ApplySourceLines(string elfFilePath, string sketchFilePath, int maxSketchLineNumber, List<CommandInformation> commands)
    {
        if (string.IsNullOrWhiteSpace(elfFilePath) ||
            !File.Exists(elfFilePath) ||
            string.IsNullOrWhiteSpace(sketchFilePath) ||
            maxSketchLineNumber <= 0 ||
            commands.Count == 0)
        {
            return;
        }

        var addressByCommandIndex = new List<(int Index, int Address)>();
        for (var index = 0; index < commands.Count; index++)
        {
            var address = commands[index].ProgramAddressByte;
            if (address.HasValue)
            {
                addressByCommandIndex.Add((index, address.Value));
            }
        }

        if (addressByCommandIndex.Count == 0)
        {
            return;
        }

        var addr2linePath = ResolveAvrAddr2LinePath();
        var sketchFileName = Path.GetFileName(sketchFilePath);

        // One avr-addr2line call for many addresses: starting a process per instruction took ~40 ms each,
        // which made source mapping most of the compile time.
        var linesByAddress = new Dictionary<int, List<string>>();
        foreach (var chunk in addressByCommandIndex.Select(entry => entry.Address).Distinct().Chunk(500))
        {
            foreach (var (address, lines) in ResolveAddresses(addr2linePath, elfFilePath, chunk))
            {
                linesByAddress[address] = lines;
            }
        }

        foreach (var (index, address) in addressByCommandIndex)
        {
            commands[index].SourceLineNumber = linesByAddress.TryGetValue(address, out var lines)
                ? ResolveSourceLine(lines, sketchFileName, maxSketchLineNumber)
                : null;
        }
    }

    // With -a, addr2line prints each address (as 0x...) before its function/file lines, so the combined
    // output can be split back into one block per address.
    private static Dictionary<int, List<string>> ResolveAddresses(string addr2linePath, string elfFilePath, int[] addresses)
    {
        var arguments = $"-e \"{elfFilePath}\" -a -f -C -i " + string.Join(' ', addresses.Select(a => $"0x{a:X}"));
        var output = RunCommand(addr2linePath, arguments)
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var result = new Dictionary<int, List<string>>();
        List<string>? current = null;
        foreach (var line in output)
        {
            if (line.StartsWith("0x") && int.TryParse(line[2..], System.Globalization.NumberStyles.HexNumber, null, out var address))
            {
                current = new List<string>();
                result[address] = current;
            }
            else
            {
                current?.Add(line);
            }
        }
        return result;
    }

    private static int? ResolveSourceLine(List<string> outputLines, string sketchFileName, int maxSketchLineNumber)
    {
        var parsed = new List<(string FilePath, int Line)>();
        foreach (var line in outputLines)
        {
            if (TryParseFileLine(line, out var filePath, out var sourceLine))
            {
                parsed.Add((filePath, sourceLine));
            }
        }

        if (parsed.Count == 0)
        {
            return null;
        }

        var preferred = parsed
            .Where(entry => Path.GetFileName(entry.FilePath).Equals(sketchFileName, StringComparison.OrdinalIgnoreCase))
            .Select(entry => entry.Line)
            .FirstOrDefault(line => line >= 1 && line <= maxSketchLineNumber);

        if (preferred > 0)
        {
            return preferred;
        }

        // Do not fall back to framework/core files when we cannot confidently map to the user's sketch.
        return null;
    }

    private static bool TryParseFileLine(string addr2LineOutput, out string filePath, out int sourceLine)
    {
        filePath = string.Empty;
        sourceLine = 0;

        if (string.IsNullOrWhiteSpace(addr2LineOutput) || addr2LineOutput.StartsWith("??"))
        {
            return false;
        }

        var lastColonIndex = addr2LineOutput.LastIndexOf(':');
        if (lastColonIndex < 0 || lastColonIndex >= addr2LineOutput.Length - 1)
        {
            return false;
        }

        var lineSegment = addr2LineOutput[(lastColonIndex + 1)..].Trim();
        var digitCount = 0;
        while (digitCount < lineSegment.Length && char.IsDigit(lineSegment[digitCount]))
        {
            digitCount++;
        }

        if (digitCount == 0)
        {
            return false;
        }

        if (!int.TryParse(lineSegment[..digitCount], out sourceLine) || sourceLine <= 0)
        {
            return false;
        }

        filePath = addr2LineOutput[..lastColonIndex].Trim();
        return filePath.Length > 0;
    }

    private static string ResolveAvrAddr2LinePath()
    {
        var candidates = new List<string>
        {
            "/opt/homebrew/bin/avr-addr2line",
            "/usr/local/bin/avr-addr2line"
        };

        var homeDirectory = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        var arduinoGccToolRoot = Path.Combine(homeDirectory, ".arduino15", "packages", "arduino", "tools", "avr-gcc");
        if (Directory.Exists(arduinoGccToolRoot))
        {
            var versionDirectories = Directory.GetDirectories(arduinoGccToolRoot)
                .OrderByDescending(path => path, StringComparer.OrdinalIgnoreCase);

            foreach (var versionDirectory in versionDirectories)
            {
                candidates.Add(Path.Combine(versionDirectory, "bin", "avr-addr2line"));
            }
        }

        var pathEnvironment = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
        foreach (var segment in pathEnvironment.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            candidates.Add(Path.Combine(segment, "avr-addr2line"));
        }

        foreach (var candidate in candidates.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }

        throw new FileNotFoundException(
            "Could not find 'avr-addr2line'. Ensure AVR toolchain is installed via arduino-cli.");
    }

    private static string RunCommand(string fileName, string arguments)
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

        using var process = Process.Start(startInfo)
            ?? throw new InvalidOperationException($"Could not start process '{fileName}'.");

        var stdout = process.StandardOutput.ReadToEnd();
        var stderr = process.StandardError.ReadToEnd();
        process.WaitForExit();

        if (process.ExitCode != 0)
        {
            var details = !string.IsNullOrWhiteSpace(stderr) ? stderr : stdout;
            throw new InvalidOperationException($"Failed to resolve ELF source lines. {details}".Trim());
        }

        return stdout;
    }
}
