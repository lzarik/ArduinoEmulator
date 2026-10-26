using System.Reflection.PortableExecutable;
using API.Data;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SharedDomainTypes;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddSingleton<MachineData>();
builder.Services.AddSingleton<Emulator.AvrSession>();

// Accounts and saved projects (see Data/OhmsterDb.cs)
builder.Services.AddDbContext<OhmsterDb>(options =>
    options.UseSqlite($"Data Source={Path.Combine(builder.Environment.ContentRootPath, "ohmster.db")}"));
builder.Services.AddSingleton<IPasswordHasher<User>, PasswordHasher<User>>();

// Signing in sets an HttpOnly cookie. The front end calls from another port on localhost, which counts
// as the same site, so the cookie can stay SameSite=Lax. API calls answer 401 instead of redirecting.
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "ohmster.auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.ExpireTimeSpan = TimeSpan.FromDays(30);
        options.SlidingExpiration = true;
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    });
builder.Services.AddAuthorization();

// Allow the ProgramVisualizer dev server to call this API (CORS)
builder.Services.AddCors(options =>
{
    options.AddPolicy("DevAllow", policy =>
    {
        // Another dev server can be allowed with e.g. --Cors:Origins:0=http://localhost:5199
        policy.WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:5173"])
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Create the database, or bring it up to date with any new migrations (Data/Migrations)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<OhmsterDb>().Database;

    // A database made before migrations were used already has the first migration's tables, so record
    // that one as applied instead of creating them again.
    var hasTables = db.SqlQueryRaw<int>("SELECT COUNT(*) AS \"Value\" FROM sqlite_master WHERE type = 'table' AND name = 'Users'").AsEnumerable().Single() > 0;
    if (hasTables && !db.GetAppliedMigrations().Any())
    {
        db.ExecuteSqlRaw("CREATE TABLE IF NOT EXISTS \"__EFMigrationsHistory\" (\"MigrationId\" TEXT NOT NULL CONSTRAINT \"PK___EFMigrationsHistory\" PRIMARY KEY, \"ProductVersion\" TEXT NOT NULL)");
        db.ExecuteSqlRaw("INSERT INTO \"__EFMigrationsHistory\" (\"MigrationId\", \"ProductVersion\") VALUES ({0}, {1})",
            db.GetMigrations().First(), Microsoft.EntityFrameworkCore.Infrastructure.ProductInfo.GetVersion());
    }

    db.Migrate();
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{   
    app.MapOpenApi();
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.UseHttpsRedirection();
}

// Enable CORS policy early in the pipeline
app.UseCors("DevAllow");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
