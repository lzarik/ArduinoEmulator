using Microsoft.EntityFrameworkCore;

namespace API.Data;

// Accounts, their saved projects and their Learn progress, kept in a SQLite file next to the API
// (ohmster.db). Changes to these tables go in a migration (Data/Migrations), applied when the API starts:
//   dotnet ef migrations add <Name> --output-dir Data/Migrations
public class OhmsterDb(DbContextOptions<OhmsterDb> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<SavedProject> Projects => Set<SavedProject>();
    public DbSet<CompletedLesson> CompletedLessons => Set<CompletedLesson>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<User>().HasIndex(u => u.UsernameKey).IsUnique();

        // Project ids are made by the browser, so they're only unique within one account.
        model.Entity<SavedProject>().HasKey(p => new { p.UserId, p.Id });
        model.Entity<SavedProject>().HasOne<User>().WithMany().HasForeignKey(p => p.UserId).OnDelete(DeleteBehavior.Cascade);

        model.Entity<CompletedLesson>().HasKey(c => new { c.UserId, c.LessonId });
        model.Entity<CompletedLesson>().HasOne<User>().WithMany().HasForeignKey(c => c.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class User
{
    public int Id { get; set; }
    /// <summary>As typed when signing up, for display.</summary>
    public required string Username { get; set; }
    /// <summary>Lowercased, so "Liz" and "liz" are the same account.</summary>
    public required string UsernameKey { get; set; }
    public required string PasswordHash { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    /// <summary>The lesson open in the Learn tab, so it opens there next time.</summary>
    public string? CurrentLessonId { get; set; }
}

public class SavedProject
{
    public required string Id { get; set; }
    public int UserId { get; set; }
    public required string Name { get; set; }
    public required string Code { get; set; }
    /// <summary>The breadboard as the front end sends it; the API only stores it.</summary>
    public required string CircuitJson { get; set; }
    /// <summary>Milliseconds since 1970, as JavaScript's Date.now().</summary>
    public long UpdatedAt { get; set; }
}

/// <summary>A Learn lesson whose quiz this account has passed (its LED is lit on the course map).</summary>
public class CompletedLesson
{
    public int UserId { get; set; }
    /// <summary>The lesson's id in the front end's course outline (lessons.ts), e.g. "first-sketch".</summary>
    public required string LessonId { get; set; }
    public DateTime CompletedAt { get; set; } = DateTime.UtcNow;
}
