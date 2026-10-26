using System.Text.RegularExpressions;
using API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

// The signed-in account's progress through the Learn course: which lessons it has finished (their
// LEDs are lit) and which lesson it had open.
[ApiController]
[Route("[controller]")]
[Authorize]
public partial class LearnController(OhmsterDb db) : ControllerBase
{
    public sealed record Progress(IEnumerable<string> Completed, string? CurrentLesson);
    public sealed record LessonRequest(string LessonId);

    // Lesson ids come from the front end's course outline, e.g. "first-sketch"
    [GeneratedRegex("^[a-z0-9-]{1,64}$")]
    private static partial Regex LessonIdPattern();

    private int UserId => AuthController.CurrentUserId(User);

    [HttpGet("Progress")]
    public async Task<ActionResult<Progress>> GetProgress()
    {
        var user = await db.Users.FindAsync(UserId);
        if (user is null) return Unauthorized();
        var completed = await db.CompletedLessons.Where(c => c.UserId == UserId).OrderBy(c => c.CompletedAt).Select(c => c.LessonId).ToListAsync();
        return new Progress(completed, user.CurrentLessonId);
    }

    /// <summary>Marks the lesson finished; finishing it again changes nothing.</summary>
    [HttpPut("Completed/{lessonId}")]
    public async Task<IActionResult> Complete(string lessonId)
    {
        if (!LessonIdPattern().IsMatch(lessonId)) return BadRequest();
        if (await db.CompletedLessons.FindAsync(UserId, lessonId) is null)
        {
            db.CompletedLessons.Add(new CompletedLesson { UserId = UserId, LessonId = lessonId });
            await db.SaveChangesAsync();
        }
        return NoContent();
    }

    /// <summary>Starts the course again: every lesson unfinished.</summary>
    [HttpDelete("Completed")]
    public async Task<IActionResult> Reset()
    {
        await db.CompletedLessons.Where(c => c.UserId == UserId).ExecuteDeleteAsync();
        return NoContent();
    }

    [HttpPut("CurrentLesson")]
    public async Task<IActionResult> SetCurrentLesson([FromBody] LessonRequest request)
    {
        if (!LessonIdPattern().IsMatch(request.LessonId ?? "")) return BadRequest();
        await db.Users.Where(u => u.Id == UserId).ExecuteUpdateAsync(u => u.SetProperty(x => x.CurrentLessonId, request.LessonId));
        return NoContent();
    }
}
