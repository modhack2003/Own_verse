import { jsonLd, SITE_URL } from '@/lib/seo';
import { HeroSection } from '@/components/sections/hero';
import { AboutSection } from '@/components/sections/about';
import { ExperienceSection } from '@/components/sections/experience';
import { ProjectsSection } from '@/components/sections/projects';
import { SkillsSection } from '@/components/sections/skills';
import { BlogSection } from '@/components/sections/blog';
import { ContactSection } from '@/components/sections/contact';
import { CtfSection } from '@/components/sections/ctf';
import { MaskedGenerator } from '@/components/sections/masked-generator';
import { VaptSection } from '@/components/sections/vapt';
import { BountySection } from '@/components/sections/bounty';
import { BountyInviteSection } from '@/components/sections/bounty-invite';
import { HeaderNav } from '@/components/header-nav';
import { SectionHeader } from '@/components/cyber/primitives';
import { ScrollCircle } from '@/components/cyber/scroll-circle';
import { getPortfolioData } from '@/lib/portfolio-data';

// Re-render at most once a minute; admin saves trigger an immediate refresh (revalidatePath).
export const revalidate = 60;

export default async function Home() {
  const { personalData, projects, githubRepos, skills, certificates, education, ctfEvents, experience, posts, postCount, bounty } =
    await getPortfolioData();

  const hasExperience = experience.length > 0;
  const hasCtf = ctfEvents.length > 0;
  const hasSkills = !!skills && skills.languages.length + skills.tools.length + skills.areas.length > 0;
  const hasBounty = bounty.findings.length > 0;
  const bountyProfiles = personalData?.bountyProfiles ?? [];

  // Years active on GitHub, from the oldest repo's creation date (rounded down, min 0).
  const oldestRepo = githubRepos.reduce<number | null>((min, r) => {
    const t = r.createdAt ? new Date(r.createdAt).getTime() : NaN;
    if (Number.isNaN(t)) return min;
    return min === null ? t : Math.min(min, t);
  }, null);
  const operatorYears = oldestRepo ? Math.max(0, Math.floor((Date.now() - oldestRepo) / (365.25 * 24 * 60 * 60 * 1000))) : 0;
  const hidden = [!hasExperience && '#experience', !hasCtf && '#ctf', !hasSkills && '#skills'].filter(Boolean) as string[];

  let n = 0;
  const idx = () => String(++n).padStart(2, '0');

  const aboutIdx = idx();
  const expIdx = hasExperience ? idx() : '';
  const projIdx = idx();
  const ctfIdx = hasCtf ? idx() : '';
  const skillIdx = hasSkills ? idx() : '';
  const vaptIdx = idx();
  const bountyIdx = hasBounty ? idx() : '';
  const inviteIdx = idx();
  const blogIdx = idx();
  const contactIdx = idx();

  return (
    <div className="flex min-h-screen flex-col">
      <HeaderNav personalData={personalData} hidden={hidden} />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({ '@context': 'https://schema.org', '@type': 'Person', name: personalData?.name ?? 'Bikram Dey', jobTitle: personalData?.title, url: SITE_URL, sameAs: [personalData?.github, personalData?.linkedin].filter(Boolean) }) }} />
        <HeroSection personalData={personalData} />

        <div className="relative">
          <div aria-hidden className="grid-cross pointer-events-none absolute inset-0 opacity-60" />
          <div className="relative mx-auto max-w-[1440px] space-y-32 px-6 py-28 sm:px-10">
            <div className="space-y-14">
              <SectionHeader id="about" index={aboutIdx} jp="自己紹介" eyebrow={`Section ${aboutIdx} / Dossier`} title="About Me" subtitle="A little bit about my journey in the digital trenches." />
              <AboutSection personalData={personalData} certificates={certificates} education={education} experienceCount={experience.length} repoCount={githubRepos.length} />
            </div>

            {hasExperience && (
              <div className="space-y-14">
                <SectionHeader id="experience" index={expIdx} jp="経歴" eyebrow={`Section ${expIdx} / Service record`} title="Work Experience" subtitle="Where I have put the skills to work." />
                <ExperienceSection items={experience} />
              </div>
            )}

            <div className="space-y-14">
              <SectionHeader id="projects" index={projIdx} jp="作品" eyebrow={`Section ${projIdx} / Payloads`} title="My Projects" subtitle="A selection of my work. See what I&apos;ve been building." />
              <ProjectsSection projects={projects} githubRepos={githubRepos} />
            </div>

            <MaskedGenerator
              profile={{
                name: personalData?.name,
                title: personalData?.title,
                location: personalData?.location,
                github: personalData?.github,
                languages: skills?.languages ?? [],
                repoCount: githubRepos.length,
                yearsActive: operatorYears,
              }}
            />

            {hasCtf && (
            <div className="space-y-14">
              <SectionHeader id="ctf" index={ctfIdx} jp="旗取り" eyebrow={`Section ${ctfIdx} / Operations`} title="CTF Competitions" subtitle="Competitive cybersecurity challenges I have participated in and highlights." />
              <CtfSection events={ctfEvents} />
            </div>
            )}

            {hasSkills && (
            <div className="space-y-14">
              <SectionHeader id="skills" index={skillIdx} jp="武器庫" eyebrow={`Section ${skillIdx} / Loadout`} title="My Arsenal" subtitle="The languages, tools, and technologies I use to build and secure applications." />
              <SkillsSection skills={skills} />
            </div>
            )}

            <div className="space-y-14">
              <SectionHeader id="vapt" index={vaptIdx} jp="侵入試験" eyebrow={`Section ${vaptIdx} / Offensive security`} title="VAPT Services" subtitle="Vulnerability assessment & penetration testing for web apps, APIs, mobile apps, networks and cloud. Tell me what needs testing and I&apos;ll come back with a scoped proposal." />
              <VaptSection email={personalData?.email} />
            </div>

            {hasBounty && (
              <div className="space-y-14">
                <SectionHeader id="bounty" index={bountyIdx} jp="賞金稼ぎ" eyebrow={`Section ${bountyIdx} / Bug bounty`} title="Hall of Fame" subtitle="Security issues I have found and responsibly disclosed to vendor security teams." />
                <BountySection findings={bounty.findings} stats={bounty.stats} profiles={bountyProfiles} />
              </div>
            )}

            {/* when there are no findings yet the nav's "Bounty" link lands on the invite section */}
            <div id={hasBounty ? undefined : 'bounty'} className="scroll-mt-24 space-y-14">
              <SectionHeader id="invite" index={inviteIdx} jp="招待状" eyebrow={`Section ${inviteIdx} / For security teams`} title="Program Invite" subtitle="Run a bug bounty program or vulnerability disclosure policy? Invite me to your private program, VDP or live hacking event." />
              <BountyInviteSection stats={hasBounty ? bounty.stats : null} profiles={bountyProfiles} />
            </div>

            <div className="space-y-14">
              <SectionHeader id="blog" index={blogIdx} jp="記録" eyebrow={`Section ${blogIdx} / Transmissions`} title="Security Insights" subtitle="My thoughts on cybersecurity trends, methodologies, and best practices." />
              <BlogSection posts={posts} total={postCount} />
            </div>
          </div>
        </div>

        <ScrollCircle>
          <div className="mx-auto max-w-[1440px] space-y-14 px-6 py-28 sm:px-10">
            <SectionHeader id="contact" index={contactIdx} jp="通信" eyebrow={`Section ${contactIdx} / Uplink`} title="Get In Touch" subtitle="Have a question or a project in mind? Let&apos;s connect." />
            <ContactSection personalData={personalData} />
          </div>
        </ScrollCircle>
      </main>
    </div>
  );
}
