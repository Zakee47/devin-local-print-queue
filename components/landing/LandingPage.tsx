import Image from "next/image";
import Link from "next/link";
import Collage from "./Collage";
import {
  LINKS,
  LONDON_EVENT_HREF,
  LUMA_CALENDAR,
  RECAP_YOUTUBE_ID,
} from "./data";
import { plexSans } from "./fonts";
import HeroVideo from "./HeroVideo";
import Loader from "./Loader";
import { CognitionLogo, DevinLogo } from "./Logos";
import Nav from "./Nav";
import Quad from "./Quad";
import Runtime from "./Runtime";
import SocialWall from "./SocialWall";
import { SOCIAL_POSTS } from "./social-posts";
import "./landing.css";

const FAQ = [
  {
    q: "Who can come?",
    a: "Anyone who builds: engineers, designers, operators and founders. Whether you've shipped with Devin before or are just curious, you're welcome.",
  },
  {
    q: "Does it cost anything?",
    a: "No. Devin Local is free. Food and drinks are on us, and every attendee gets Devin credits.",
  },
  {
    q: "Do I need to know Devin already?",
    a: "No. Plenty of people use Devin for the first time at a Devin Local, and the Cognition team is in the room to help you get going.",
  },
  {
    q: "What should I bring?",
    a: "A laptop, a charger and good energy. Stay for the whole event and lock in, or just drop by. Either way, we're excited to meet you.",
  },
  {
    q: "How do I hear about the next one?",
    a: (
      <>
        Follow <a href={LUMA_CALENDAR}>Cognition on Luma</a>, and keep an eye on{" "}
        <a href={LINKS.cognitionX}>@cognition</a> and <a href={LINKS.devinX}>@DevinAI</a>. Spaces are
        limited and registration needs approval, so sign up early.
      </>
    ),
  },
];

const delay = (s: number) => ({ ["--d" as string]: `${s}s` });

// The Devin Local landing page: a global page for the series, with London #01
// as the first event. The event app itself lives at /london-01.
export default function LandingPage() {
  return (
    <div className={`dl ${plexSans.variable}`} id="dl-root">
      <link rel="preload" as="image" href="/landing/hero-poster.jpg" fetchPriority="high" />
      <Loader />
      <Nav />
      <main id="main-content">
        <section className="dl-hero dl-dark" id="top">
          <HeroVideo />
          <div className="tint" />
          <div className="dl-wrap">
            <div className="dl-presents">
              <CognitionLogo className="dl-logo" />
              <span>presents</span>
            </div>
            <div className="dl-otter">
              <Image src="/landing/otter.png" alt="" width={120} height={110} sizes="120px" priority />
            </div>
            <h1>
              Devin<span className="l2">Local</span>
            </h1>
            <p>Engineers, designers, founders, and Devin, all under one roof.</p>
            <div className="dl-ctas">
              <a className="dl-btn dl-btn-y" href={LUMA_CALENDAR}>
                Join our next event
              </a>
              <a className="dl-btn dl-btn-ghost" href="#recap">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Watch the recap
              </a>
            </div>
          </div>
        </section>

        <section className="dl-seam" id="london" data-tone="cream" data-tone-offset="190">
          <div className="dl-wrap">
            <article className="dl-eventcard" data-reveal="scale">
              <div className="poster">
                <Image
                  src="/landing/poster.png"
                  alt="Devin Local London poster: an otter on a yellow ring in the Thames"
                  width={600}
                  height={600}
                  sizes="(max-width: 900px) 100vw, 420px"
                />
              </div>
              <div className="body">
                <span className="dl-tag">1st October</span>
                <h2>Devin Local - London</h2>
                <p>
                  We gathered over 200 engineers, designers, operators, and founders for a casual evening of
                  co-working, shipping, and hands-on building with Devin AI. From deep-dive coding sessions to a
                  high-stakes 3D printing competition, the energy from the London builder community was
                  unmatched.
                </p>
                <Link className="dl-btn dl-btn-ink" href={LONDON_EVENT_HREF}>
                  See the event
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>
              </div>
            </article>
          </div>
        </section>

        <section className="dl-about" id="about" data-tone="cream">
          <div className="dl-wrap">
            <div>
              <div className="dl-eyebrow" data-reveal>
                What is Devin Local
              </div>
              <h2 data-reveal style={delay(0.05)}>
                Builders in one room, shipping with Devin.
              </h2>
              <p data-reveal style={delay(0.1)}>
                Devin Local is Cognition&apos;s series of co-working sessions for engineers, designers, operators,
                and founders. We take over a local space, bring the builder community under one roof, and spend
                the session shipping with Devin.
              </p>
              <ul className="dl-pts">
                <li data-reveal style={delay(0.15)}>
                  <b>Devin credits</b>
                  <span>Every attendee gets credits to build with on the day.</span>
                </li>
                <li data-reveal style={delay(0.22)}>
                  <b>Food and drinks</b>
                  <span>On us, for the whole session.</span>
                </li>
                <li data-reveal style={delay(0.29)}>
                  <b>Side-challenge + prize</b>
                  <span>Every session has one, and someone goes home with the prize.</span>
                </li>
              </ul>
            </div>
            <Quad />
          </div>
        </section>

        <section className="dl-recap" id="recap" data-tone="sand">
          <div className="dl-wrap">
            <div className="head">
              <div className="dl-eyebrow" data-reveal>
                Recap
              </div>
              <h2 data-reveal style={delay(0.05)}>
                London #01
              </h2>
              <p data-reveal style={delay(0.1)}>
                Co-working, keychains coming off the printers, live voting on the roof, and a 3D printer going
                home with the winner.
              </p>
            </div>
            <div className="dl-video" data-reveal="scale" style={delay(0.1)}>
              <iframe
                src={`https://www.youtube.com/embed/${RECAP_YOUTUBE_ID}?mute=1&rel=0&playsinline=1`}
                title="Devin Local London recap"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </div>
        </section>

        <section className="dl-social" id="social" data-tone="cream">
          <div className="dl-wrap">
            <div className="head">
              <div className="dl-eyebrow" data-reveal>
                Testimonials
              </div>
              <h2 data-reveal style={delay(0.05)}>
                The Devin community has spoken
              </h2>
            </div>
            <SocialWall posts={SOCIAL_POSTS} />
          </div>
        </section>

        <section className="dl-faq" id="faq" data-tone="sand">
          <div className="dl-wrap">
            <div>
              <div className="dl-eyebrow" data-reveal>
                FAQ
              </div>
              <h2 data-reveal style={delay(0.05)}>
                Got questions?
                <br />
                We&apos;ve got answers.
              </h2>
            </div>
            <div>
              {FAQ.map((item, i) => (
                <details key={item.q} data-reveal style={delay(0.06 * i)}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <Collage />
      </main>

      <footer className="dl-footer">
        <div className="dl-wrap">
          <div className="logos">
            <a href={LINKS.cognition} target="_blank" rel="noopener noreferrer" aria-label="Cognition website">
              <CognitionLogo className="dl-logo" />
            </a>
            <span className="x" />
            <a href={LINKS.devin} target="_blank" rel="noopener noreferrer" aria-label="Devin website">
              <DevinLogo className="dl-logo" />
            </a>
          </div>
          <p>
            Devin Local is Cognition&apos;s community series of co-working sessions for builders. London is
            where it started.
          </p>
          <div className="soc">
            <a href={LINKS.cognitionX} target="_blank" rel="noopener noreferrer" aria-label="Cognition on X">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.9 2H22l-7.6 8.7L23 22h-6.8l-5.3-6.9L4.8 22H1.7l8.1-9.3L1 2h7l4.8 6.3L18.9 2zm-1.2 18h1.9L7.4 3.9H5.4L17.7 20z" />
              </svg>
            </a>
            <a
              href={LINKS.cognitionLinkedIn}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Cognition on LinkedIn"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4.98 3.5A2.5 2.5 0 1 1 5 8.5a2.5 2.5 0 0 1-.02-5zM3 9h4v12H3zm7 0h3.8v1.7h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V21h-4v-5.3c0-1.3 0-2.9-1.8-2.9s-2 1.4-2 2.8V21h-4z" />
              </svg>
            </a>
          </div>
        </div>
        <div className="dl-wrap bottom">
          <span>© {new Date().getFullYear()} Cognition AI, Inc.</span>
        </div>
      </footer>
      <Runtime />
    </div>
  );
}
