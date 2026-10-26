using System.Text.Json;
using API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

// The signed-in account's saved projects. Every query is limited to that account, so nobody can read
// or change anyone else's projects.
[ApiController]
[Route("[controller]")]
[Authorize]
public class ProjectsController(OhmsterDb db) : ControllerBase
{
    public sealed record ProjectDto(string Id, string Name, string Code, JsonElement Circuit, long UpdatedAt);

    private const int MaxCodeLength = 200_000;
    private const int MaxCircuitLength = 1_000_000;

    private int UserId => AuthController.CurrentUserId(User);

    [HttpGet]
    public async Task<IEnumerable<ProjectDto>> List()
    {
        var projects = await db.Projects.Where(p => p.UserId == UserId).OrderByDescending(p => p.UpdatedAt).ToListAsync();
        return projects.Select(p => new ProjectDto(p.Id, p.Name, p.Code, JsonDocument.Parse(p.CircuitJson).RootElement, p.UpdatedAt));
    }

    /// <summary>Creates the project, or replaces it if this account already has one with that id.</summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> Save(string id, [FromBody] ProjectDto project)
    {
        var circuitJson = project.Circuit.GetRawText();
        if (id != project.Id || id.Length is 0 or > 64) return BadRequest();
        if (project.Code.Length > MaxCodeLength || circuitJson.Length > MaxCircuitLength) return BadRequest("Project is too large.");

        var name = string.IsNullOrWhiteSpace(project.Name) ? "Untitled project" : project.Name.Trim();
        if (name.Length > 100) name = name[..100];

        var saved = await db.Projects.FindAsync(UserId, id);
        if (saved is null)
        {
            db.Projects.Add(new SavedProject { Id = id, UserId = UserId, Name = name, Code = project.Code, CircuitJson = circuitJson, UpdatedAt = project.UpdatedAt });
        }
        else
        {
            saved.Name = name;
            saved.Code = project.Code;
            saved.CircuitJson = circuitJson;
            saved.UpdatedAt = project.UpdatedAt;
        }
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        await db.Projects.Where(p => p.UserId == UserId && p.Id == id).ExecuteDeleteAsync();
        return NoContent();
    }
}
