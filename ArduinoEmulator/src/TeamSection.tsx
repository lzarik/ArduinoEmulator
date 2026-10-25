import { useState, type CSSProperties } from 'react'
import { HamsterWheel } from './HamsterWheel'
import { TEAM, type TeamMember } from './team'

// The "Meet the Team" notebook page: a photo of each person taped into the notebook, with their name,
// role and a few words about them (from team.ts).

function TeamCard({ member, index }: { member: TeamMember; index: number }) {
  // Until the photo file is in public/team/, show a placeholder instead of a broken image.
  const [missing, setMissing] = useState(false)
  return (
    <figure className="team-card" style={{ '--tilt': `${index % 2 ? 1.6 : -1.6}deg` } as CSSProperties}>
      <div className={`team-photo${missing ? ' placeholder' : ''}`}>
        {missing ? (
          <>
            <HamsterWheel className="team-photo-hamster" />
            <span>Photo coming soon</span>
          </>
        ) : (
          <img
            src={member.photo}
            alt={member.name}
            loading="lazy"
            style={{
              objectPosition: member.focus,
              transformOrigin: member.focus,
              transform: member.zoom ? `scale(${member.zoom})` : undefined,
            }}
            onError={() => setMissing(true)}
          />
        )}
      </div>
      <figcaption>
        <span className="team-name">{member.name}</span>
        {member.role && <span className="team-role">{member.role}</span>}
        {member.bio && <p className="team-bio">{member.bio}</p>}
      </figcaption>
    </figure>
  )
}

export function TeamSection() {
  return (
    <div className="team-grid">
      {TEAM.map((member, i) => (
        <TeamCard key={member.name} member={member} index={i} />
      ))}
    </div>
  )
}
