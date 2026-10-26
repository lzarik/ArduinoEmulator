using System.Security.Claims;
using System.Text.RegularExpressions;
using API.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

// Ohmster accounts: sign up, log in and out, and who's signed in. Being signed in is an HttpOnly cookie
// that lasts 30 days; passwords are stored only as salted hashes (ASP.NET's PasswordHasher).
[ApiController]
[Route("[controller]")]
public partial class AuthController(OhmsterDb db, IPasswordHasher<User> hasher) : ControllerBase
{
    public sealed record Credentials(string Username, string Password);
    public sealed record AccountInfo(string Username);

    public const int MinPasswordLength = 8;

    [GeneratedRegex("^[A-Za-z0-9._-]{3,32}$")]
    private static partial Regex UsernamePattern();

    [HttpPost("SignUp")]
    public async Task<ActionResult<AccountInfo>> SignUp([FromBody] Credentials request)
    {
        var username = request.Username?.Trim() ?? "";
        if (!UsernamePattern().IsMatch(username))
            return BadRequest(Error("Usernames are 3 to 32 letters, numbers, dots, dashes or underscores."));
        if ((request.Password ?? "").Length < MinPasswordLength)
            return BadRequest(Error($"Passwords need at least {MinPasswordLength} characters."));

        var key = username.ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.UsernameKey == key))
            return Conflict(Error("That username is taken."));

        var user = new User { Username = username, UsernameKey = key, PasswordHash = "" };
        user.PasswordHash = hasher.HashPassword(user, request.Password!);
        db.Users.Add(user);
        await db.SaveChangesAsync();

        await SignInAs(user);
        return new AccountInfo(user.Username);
    }

    [HttpPost("LogIn")]
    public async Task<ActionResult<AccountInfo>> LogIn([FromBody] Credentials request)
    {
        var key = request.Username?.Trim().ToLowerInvariant() ?? "";
        var user = await db.Users.SingleOrDefaultAsync(u => u.UsernameKey == key);
        // The same message either way, so the form doesn't reveal which usernames exist
        if (user is null || hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password ?? "") == PasswordVerificationResult.Failed)
            return Unauthorized(Error("Wrong username or password."));

        await SignInAs(user);
        return new AccountInfo(user.Username);
    }

    [HttpPost("LogOut")]
    public async Task<IActionResult> LogOut()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
    }

    /// <summary>The signed-in account, or 401 when nobody is signed in.</summary>
    [Authorize]
    [HttpGet("Me")]
    public async Task<ActionResult<AccountInfo>> Me()
    {
        var user = await db.Users.FindAsync(CurrentUserId(User));
        return user is null ? Unauthorized() : new AccountInfo(user.Username);
    }

    public static int CurrentUserId(ClaimsPrincipal principal) =>
        int.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");

    private Task SignInAs(User user)
    {
        var identity = new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()), new Claim(ClaimTypes.Name, user.Username)],
            CookieAuthenticationDefaults.AuthenticationScheme);
        return HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity),
            new AuthenticationProperties { IsPersistent = true });
    }

    private static ProblemDetails Error(string message) => new() { Detail = message };
}
