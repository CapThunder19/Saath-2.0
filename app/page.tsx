import Link from "next/link";
import HeroSlideshow from "@/components/HeroSlideshow";
import PhotoCarousel from "@/components/PhotoCarousel";
import { EVENT } from "@/lib/registration";

const eventDetails = [
  { label: "When", value: EVENT.date, note: EVENT.time },
  { label: "Where", value: EVENT.venue, note: "A little closer to making a difference" },
  { label: "Entry", value: EVENT.entry, note: "Bring your time. Bring your heart." },
];

export default function Home() {
  return (
    <main id="main-content">
      <section className="event-hero">
        <div className="container event-hero-grid">
          <div className="event-intro">
            <span className="eyebrow">A HUHC initiative <span aria-hidden="true">/</span> The second chapter</span>
            <span className="registration-pill"><span aria-hidden="true" /> Registrations open</span>
            <h1>Saath<span className="edition">2.0</span><span className="hero-flower" aria-hidden="true">✳</span></h1>
            <p className="hero-subtitle">{EVENT.tagline}.</p>
            <p className="hero-description">A little time. A little care.<br />A whole lot of difference, <em>together.</em></p>
            <p className="hero-support">Join our artwork collection and drawing competition this Diwali. Create, contribute and celebrate with us on 26–27 October 2026.</p>
            <div className="hero-actions">
              <Link href="/register" className="btn btn-primary">Be part of Saath <span aria-hidden="true">↗</span></Link>
              <a href="#event" className="text-link">Explore the event <span aria-hidden="true">↓</span></a>
            </div>
            <p className="participation-note">Volunteer · Participant · Donor · Member</p>
          </div>
          <figure className="hero-photo">
            <HeroSlideshow />
            <figcaption><span>Small efforts. Shared joy.</span><small>A glimpse of our first chapter</small></figcaption>
            <div className="photo-stamp" aria-hidden="true">Made with<br /><strong>heart ♡</strong></div>
          </figure>
        </div>
      </section>

      <section id="event" className="event-info">
        <div className="container event-info-grid">
          <div className="event-info-title"><span className="eyebrow">Save a little time for good</span><h2>The next chapter<br />starts with you.</h2></div>
          {eventDetails.map((detail) => <div className="event-info-item" key={detail.label}><span className="eyebrow">{detail.label}</span><h3>{detail.value}</h3><p>{detail.note}</p></div>)}
        </div>
      </section>

      <section className="programme-section" aria-labelledby="programme-title">
        <div className="container">
          <div className="section-heading">
            <div><span className="eyebrow">Saath 2.0 · Diwali celebration</span><h2 id="programme-title">{EVENT.activity}</h2></div>
            <p>Bring your creativity to the College Amphitheatre. Donate your artwork and crafts, take part in the drawing competition, and join us for the final exhibition and sale.</p>
          </div>
          <div className="programme-summary"><span>{EVENT.date}</span><span>{EVENT.time}</span><span>{EVENT.venue}</span></div>
          <div className="programme-days">
            <article className="programme-day">
              <div className="day-date"><span>OCT</span><strong>26</strong><span>2026 · DAY 01</span></div>
              <div><span className="eyebrow">Artwork & craft collection</span><h3>Share something you&apos;ve made.</h3><p>Submit your artwork and crafts at the College Amphitheatre between 4:30 PM and 6:00 PM. Your donated creations will become part of the final exhibition and sale on 27 October.</p><p className="programme-note">Bring your artwork and handmade crafts for submission.</p></div>
            </article>
            <article className="programme-day">
              <div className="day-date"><span>OCT</span><strong>27</strong><span>2026 · DAY 02</span></div>
              <div><span className="eyebrow">Final exhibition & sale</span><h3>Let creativity bring us together.</h3><p>Visit the College Amphitheatre between 4:30 PM and 6:00 PM for the final exhibition and sale of all donated items. Explore the artwork and crafts, celebrate the contributors, and purchase a creation to take home.</p><p className="programme-note">All donated items will be exhibited and offered for sale.</p></div>
            </article>
          </div>
          <div className="competition-note"><div><h3>Drawing competition</h3><p>The drawing competition is part of this two-day event. Its exact schedule, theme, materials and participation rules will be announced by the organisers.</p></div><Link href="/register" className="btn btn-primary">Register for the event <span aria-hidden="true">↗</span></Link></div>
        </div>
      </section>
      <section className="story-section">
        <div className="container">
          <div className="section-heading"><div><span className="eyebrow">The spirit of Saath</span><h2>Good things happen<br />when we come <em>together.</em></h2></div><p>Saath means “together”. Our second edition brings volunteers, supporters and children together again for two days of creativity, connection and care. One small effort, shared by many.</p></div>
          <PhotoCarousel />
        </div>
      </section>

    </main>
  );
}

