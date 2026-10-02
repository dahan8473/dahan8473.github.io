# Generates the pages of davidliu.work as plain HTML: home, resume, projects,
# hobbies (and every hobby page), brain and notes. The case studies (tethos,
# dashboard, rag, kunlun) and 404 are written by hand; this only bumps their
# asset versions. Bump the V_ numbers when the CSS or JS changes.
# Run: python3 tools/build.py
import os, re, sys

REPO = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V_CSS, V_TALKCSS, V_JS, V_TALK = 23, 7, 21, 17

ICONS = {
  'home': '<path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19z"/>',
  'resume': '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  'projects': '<path d="M8.5 8l-4 4 4 4M15.5 8l4 4-4 4M13.5 5.5l-3 13"/>',
  'hobbies': '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"/>',
  'brain': '<circle cx="6" cy="7" r="2.2"/><circle cx="18" cy="6" r="2.2"/><circle cx="12" cy="17.5" r="2.2"/><path d="M8.2 6.7l7.6-.5M7.2 9l3.6 6.6M17 8.1l-3.9 7.4"/>',
  'notes': '<path d="M5 4.5h14a1 1 0 0 1 1 1V15l-5.5 5.5H5a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1z"/><path d="M14.5 20.5V16a1 1 0 0 1 1-1H20M8 9h8M8 12.5h5"/>',
  'email': '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  'messages': '<path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5h-8.5L6 20v-3.5H5A1.5 1.5 0 0 1 3.5 15V6.5A1.5 1.5 0 0 1 5 5z"/><path d="M8 9.5h8M8 12.5h5"/>',
}
RAIL = [('home', '/', 'Home'), ('resume', '/resume/', 'Resume'), ('projects', '/projects/', 'Projects'), ('hobbies', '/hobbies/', 'Hobbies'), ('brain', '/brain/', 'Brain'), ('notes', '/notes/', 'Notes')]


def rail(on):
    out = ['  <nav class="rail" aria-label="Pages">']
    for key, href, name in RAIL:
        cur = ' class="on" aria-current="page"' if key == on else ''
        out.append(f'    <a href="{href}"{cur}><svg viewBox="0 0 24 24" aria-hidden="true">{ICONS[key]}</svg><span>{name}</span></a>')
    out.append('    <span class="sep" aria-hidden="true"></span>')
    cur = ' class="on" aria-current="page"' if on == 'messages' else ''
    out.append(f'    <a href="/messages/"{cur}><svg viewBox="0 0 24 24" aria-hidden="true">{ICONS["messages"]}</svg><span>Messages</span></a>')
    out.append('  </nav>')
    return '\n'.join(out) + '\n'


TOP = '''    <header class="top">
      <a class="me" href="/">David Liu</a>
      <span class="what">Software engineer</span>
      <div class="end">
        <span>London <span id="clock">--:--</span></span>
        <button class="theme-toggle" aria-label="Toggle theme" type="button">
          <svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
          <svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
      </div>
    </header>
'''

LDJSON = '''  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": "David Liu",
    "url": "https://davidliu.work/",
    "jobTitle": "Software Engineer",
    "email": "mailto:davidliu8473@gmail.com",
    "alumniOf": { "@type": "CollegeOrUniversity", "name": "University of Western Ontario" },
    "worksFor": { "@type": "Organization", "name": "Tethos", "url": "https://tethos.ca" },
    "sameAs": ["https://github.com/dahan8473", "https://x.com/davidliu8473", "https://www.linkedin.com/in/davidmakesmoves"]
  }
  </script>
'''


def page(path, title, desc, body, on, cls='', wide=False, back=None, ld=False):
    full = 'David Liu' if title == 'David Liu' else f'{title} · David Liu'
    back_html = f'    <a class="back" href="{back[0]}">&#8592; {back[1]}</a>\n' if back else ''
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{full}</title>
  <meta name="description" content="{desc}">
  <link rel="canonical" href="https://davidliu.work{path}">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="David Liu">
  <meta property="og:url" content="https://davidliu.work{path}">
  <meta property="og:title" content="{full}">
  <meta property="og:description" content="{desc}">
  <meta property="og:image" content="https://davidliu.work/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="David Liu. davidliu.work">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@davidliu8473">
  <meta name="twitter:creator" content="@davidliu8473">
  <meta name="twitter:title" content="{full}">
  <meta name="twitter:description" content="{desc}">
  <meta name="twitter:image" content="https://davidliu.work/og.png">

  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E.%3C/text%3E%3C/svg%3E">
  <link rel="stylesheet" href="/styles.css?v={V_CSS}">
  <link rel="stylesheet" href="/talk/talk.css?v={V_TALKCSS}">
{LDJSON if ld else ''}  <script>
    (function () {{
      var stored = null;
      try {{ stored = localStorage.getItem('theme'); }} catch (e) {{}}
      var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', stored || (dark ? 'dark' : 'light'));
    }})();
  </script>
</head>
<body{f' class="{cls}"' if cls else ''}>
  <a class="skip" href="#main">Skip to content</a>

{rail(on)}
  <div class="page{' wide' if wide else ''}">
{TOP}{back_html}
    <main id="main">
{body}    </main>

    <footer class="foot">
      <span>&copy; 2026 David Liu</span>
    </footer>
  </div>

  <script src="/site.js?v={V_JS}"></script>
  <script src="/talk/talk.js?v={V_TALK}"></script>
</body>
</html>
'''


def write(rel, html):
    p = os.path.join(REPO, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w').write(html)
    print('wrote', rel)


def ext(href, text):
    return f'<a class="ln out" href="{href}">{text}</a>'


def link(href, text):
    return f'<a class="ln" href="{href}">{text}</a>'


# ---- Home -------------------------------------------------------------------

home = '''      <section class="hello" data-t="now">
        <p><em>Hi, I'm David.</em> I'm in my fourth year of Software Engineering at Western.</p>
        <p>I run <em>Tethos</em>, a nonprofit where 250+ student developers build free software for other nonprofits. I just finished <em>sixteen months at J.D. Power</em> as a software engineering intern, and I'm looking for a software engineering internship for Summer 2027.</p>
        <p>The floating head in the corner is an AI version of me, wired into <a class="ln" href="/brain/">my second brain</a>, a condensed copy of my Obsidian notes. It knows a lot about me, so ask it anything.</p>
      </section>

      <ul class="list doors">
        <li><a class="row" href="/resume/"><span class="p">Resume</span><span class="s">Everything I've done on one page. Hover anything for more.</span><span class="m">&#8594;</span></a></li>
        <li><a class="row" href="/projects/"><span class="p">Projects</span><span class="s">What I've built, with the stack and the code.</span><span class="m">&#8594;</span></a></li>
        <li><a class="row" href="/hobbies/"><span class="p">Hobbies</span><span class="s">Classical guitar, Muay Thai, travel, and a cat who's always chudding around.</span><span class="m">&#8594;</span></a></li>
        <li><a class="row" href="/brain/"><span class="p">Brain</span><span class="s">The notes the head thinks with, from my Obsidian vault.</span><span class="m">&#8594;</span></a></li>
        <li><a class="row" href="/notes/"><span class="p">Notes</span><span class="s">Leave me a note on the wall, signed or anonymous.</span><span class="m">&#8594;</span></a></li>
      </ul>

      <p class="reach" data-t="contact">
        <a class="ln" href="mailto:davidliu8473@gmail.com" aria-label="Email">davidliu8473@gmail.com</a>
        <a class="ln out" href="https://github.com/dahan8473" aria-label="GitHub">GitHub</a>
        <a class="ln out" href="https://www.linkedin.com/in/davidmakesmoves" aria-label="LinkedIn">LinkedIn</a>
        <a class="ln out" href="https://x.com/davidliu8473" aria-label="X">X</a>
      </p>
'''
write('index.html', page('/', 'David Liu', 'Software engineering at Western. Founder of Tethos, a nonprofit where 250+ student developers build free software for nonprofits. 16 months as a software engineering intern at J.D. Power.', home, 'home', cls='home', ld=True))


# ---- Resume -----------------------------------------------------------------

def item(t, lines, bullets=None, note=None, plain=False):
    """One resume entry. lines: list of (left, right) pairs; the first is the title row."""
    rows = []
    for i, (left, right) in enumerate(lines):
        cls = 'r-line first' if i == 0 else 'r-line'
        rows.append(f'          <div class="{cls}"><span>{left}</span><span class="t3">{right}</span></div>')
    bl = ''
    if bullets:
        bl = '\n          <ul class="r-bullets">\n' + '\n'.join(f'            <li>{b}</li>' for b in bullets) + '\n          </ul>'
    nt = ''
    if note:
        nt = '\n          <aside class="note"><div>\n' + '\n'.join(f'            {n}' for n in note) + '\n          </div></aside>'
    attrs = f' data-t="{t}"' if t else ''
    kind = 'r-item plain' if plain or not note else 'r-item'
    tab = '' if plain or not note else ' tabindex="0"'
    return f'        <div class="{kind}"{attrs}{tab}>\n' + '\n'.join(rows) + bl + nt + '\n        </div>\n'


def sec(sid, name, items):
    return f'      <section class="r-sec" id="{sid}" data-t="{sid}" aria-labelledby="{sid}-h">\n        <h2 id="{sid}-h">{name}</h2>\n' + ''.join(items) + '      </section>\n\n'


def img(src, alt, w, h):
    return f'<img src="{src}" alt="{alt}" width="{w}" height="{h}" loading="lazy">'


resume = '''      <header class="doc-head">
        <div>
          <h1>Resume</h1>
          <p class="hint"><span class="mouse">Hover anything for more. Click to keep it open.</span><span class="touch">Tap anything for more.</span></p>
        </div>
        <p class="go"><a class="ln" href="/resume-swe.pdf">PDF</a><a class="ln" href="/resume-pm.pdf">Product version</a></p>
      </header>

      <div class="doc">
'''
resume += sec('education', 'Education', [
  item('western', [('<b>Western University</b>', 'Sep 2022 – Apr 2028'), ('B.E.Sc. Software Engineering, co-op', 'London, ON')],
       note=['<p>Fourth year, graduating April 2028.</p>',
             '<p><span class="t1">This term</span> Artificial Intelligence, Software Testing, Multiagent Systems, and Information Security.</p>']),
])
resume += sec('experience', 'Experience', [
  item('jdpower', [('<b>J.D. Power</b>', 'May 2025 – Aug 2026'), ('Software Engineering Intern, 16-month co-op', 'London, ON')],
       ['Built and maintained Spring Boot services on Kubernetes powering the Build &amp; Price sites and analytics connectors for five Stellantis brands: Jeep, RAM, Dodge, Chrysler and Maserati',
        'Fixed the backend and data-pipeline defects blocking the model-year 2026 launch, restoring the vehicle customization flow in production',
        'Remediated 2,000+ TruffleHog secret-scanning findings, rotated leaked keys, and wrote a research report on GitHub Copilot for automated vulnerability detection'],
       note=['<p>Sixteen months on the team behind the Build &amp; Price sites. The Copilot report went to engineering leadership and was adopted.</p>',
             '<p>Also a Swagger UI security migration and CI/CD work.</p>',
             '<p class="stack">Java · Spring Boot · Kubernetes · Kafka</p>']),
  item('modern', [('<b>Modern Engineering</b>', 'May – Sep 2024'), ('Software &amp; Robotics Engineering Intern', 'Delta, BC')],
       ['Programmed a UR5 collaborative robot arm in Python over RTDE: a six-program motion library for object retrieval, conveyor placement, part sanding, and camera-guided stacking with OpenCV'],
       note=['<p>Python talking to the arm directly over RTDE. OpenCV finds the parts for the stacking program.</p>',
             '<p class="stack">Python · RTDE · OpenCV</p>',
             '<p class="go">' + ext('https://github.com/dahan8473/ModernEngineering_UR', 'Code') + '</p>']),
  item('tsinghua', [('<b>Tsinghua University</b>', 'Summer 2023'), ('AI Research Assistant', 'Beijing')],
       note=['<p>A summer of lip-sync research on Wav2Lip.</p>']),
])
resume += sec('leadership', 'Leadership', [
  item('tethos', [('<b>Tethos</b>', 'May 2024 – now'), ('Founder and President', 'London, ON')],
       ["Solo-founded Western's largest student-run tech organization, now a federally incorporated nonprofit: 250+ student developers, an 80+ person exec team, and chapters at Western and UBC",
        'Delivered 20+ pro-bono projects for nonprofits including World Vision, the Canadian Red Cross and the London Children\'s Museum, saving partners $500,000+',
        '<span data-t="genesis">Produced GENESIS, London\'s largest student demo day: 260+ attendees, 7 project demos, 8 sponsors and $12,000 raised</span>'],
       note=[img('/media/work/tethos-team.webp', 'The Tethos team in front of a Western University building', 1400, 934),
             '<p>Nonprofits apply, and teams of student PMs and developers build what they need for free. This year I\'m handing it to the next team and staying on as an advisor.</p>',
             '<p class="go">' + link('/tethos/', 'Case study') + ext('https://tethos.ca', 'tethos.ca') + '</p>']),
  item('wfn', [('<b>Western Founders Network</b>', '2023 – 2025'), ('VP of Education', 'London, ON')],
       note=["<p>Ran Ontario's largest hackathon education event.</p>"]),
  item('mentoring', [('<b>Mentoring and judging</b>', ''), ('Hack Western mentor, Western AI mentor, Ignition Hacks judge, Muay Thai club beginner coach', '')], plain=True),
])
resume += sec('projects', 'Projects', [
  item('tethos-platform', [('<b>Tethos Platform</b>, tethos.ca', 'May 2026 – now'), ('Next.js, TypeScript, FastAPI, Supabase, React Three Fiber', '')],
       ['Solo-built a 2.5D multiplayer world as the member portal: 875+ 3D assets, procedural terrain, a 91-species fishing system, and a dual-currency economy enforced by Postgres RPCs',
        'Five LLM characters cloned from real execs, with per-member memory so they remember you between visits',
        'A multi-agent dev pipeline of role-scoped Claude Code agents (build, QA, reviewer) that shipped 70+ unattended build iterations',
        'The platform around it: 59 API routes, five tiers of role-based access, and a recruiting dashboard that has processed 240+ applications'],
       note=[img('/media/work/island-overview.webp', 'Tethos Island, the member dashboard, in daylight', 1400, 706),
             '<p>Standing on the ground used to cost 15,000 sin and floor calls a second, until I baked the terrain into a grid.</p>',
             '<p class="go">' + link('/dashboard/', 'How the island works') + link('/rag/', 'The RAG service') + '</p>']),
  item('hackthenorth', [('<b>Among Us, IRL</b>', 'Sep 2026'), ('C++, ESP32-C3, ESP-NOW, PlatformIO', 'Hack the North')],
       ['Built the game for real-life Among Us on conference badges: role dealing, the kill, report and meeting state machine, on-badge voting, and NFC tasks with motion minigames',
        'No server, router or phones: game state syncs peer to peer over a mesh, and signal strength decides if you\'re close enough to kill'],
       note=[img('/media/work/htn-badges.webp', 'Two Hack the North badges running Among Us', 1000, 750),
             '<p>36 hours, team of three. The first prototype in Lua ran the badge out of memory, and the stock firmware rebooted whenever the radio turned on, so we flashed our own.</p>',
             '<p class="go">' + ext('https://github.com/dahan8473/htn-amongus', 'Code') + ext('https://devpost.com/software/among-us-lbrwjk', 'Devpost') + '</p>']),
  '        <p class="r-more"><a class="ln" href="/projects/">All projects, with the stack and the code &#8594;</a></p>\n',
])
resume += sec('awards', 'Awards', [
  item('award-htn', [('<b>Hack the North 2026</b>', '$2,500'), ('1st, Best Use of Solana and Badge Hack', '')],
       note=['<p>For Among Us, IRL.</p>', '<p class="go">' + ext('https://devpost.com/software/among-us-lbrwjk', 'Devpost') + '</p>']),
  item('award-telus', [('<b>TELUS AI at the Edge of Innovation</b>', '$5,000'), ('2nd place, for biopilot', '')],
       note=[img('/media/work/biopilot-heatmap.webp', 'A crop-health heatmap over farm fields', 1200, 750),
             '<p>biopilot turns drone footage into crop-health maps.</p>',
             '<p class="go">' + ext('https://github.com/dahan8473/biopilot', 'Code') + '</p>']),
  item(None, [('<b>UofT Hacks</b>', ''), ('Top 5 finalist', '')], plain=True),
  item('award-wec', [('<b>Western Engineering Competition</b>', ''), ('Finalist', '')],
       note=['<p>Code from our 2024 entry, built in Unity and C#.</p>', '<p class="go">' + ext('https://github.com/dahan8473/WEC_24', 'Code') + '</p>']),
  item('award-guitar', [('<b>NW Guitar Competition</b>', ''), ('2nd place, classical guitar. Also played Carnegie Hall', '')],
       note=['<p>Four recordings on the guitar page.</p>', '<p class="go">' + link('/hobbies/guitar/', 'Listen') + '</p>']),
])
resume += sec('skills', 'Skills', [
  item(None, [('<b>Languages</b>', ''), ('Python, Java, C++, Go, JavaScript, TypeScript, SQL, HTML/CSS', '')],
       note=['<p>Java at J.D. Power. Python for the UR5 arm and every FastAPI backend. C++ on the Hack the North badges. TypeScript across Tethos, biopilot, deja-view and clawdash. SQL in Supabase, with row-level security and server-side functions.</p>']),
  item(None, [('<b>Frameworks</b>', ''), ('React, Next.js, Node.js, Express, Spring Boot, FastAPI, Flask, React Three Fiber, GSAP, Tailwind', '')],
       note=['<p>Spring Boot at J.D. Power. Next.js and FastAPI for Tethos and most hackathons. React Three Fiber for Tethos Island.</p>']),
  item(None, [('<b>AI and data</b>', ''), ('Anthropic and OpenAI APIs, RAG, OpenCV, PyTorch, TensorFlow, PostgreSQL, Supabase, MongoDB, Kafka', '')],
       note=['<p>RAG over Tethos\'s Drive and Notion with pgvector. YOLOv8 for biopilot. Kafka at J.D. Power. The floating head on this site runs on DeepSeek and Jev.</p>']),
  item(None, [('<b>Systems</b>', ''), ('Docker, Kubernetes, AWS, Linux, Git, GitHub Actions, ESP32, Arduino, PlatformIO', '')],
       note=['<p>Kubernetes at J.D. Power. Docker on Cloud Run for the RAG service. snake-and-commits is a GitHub Action. ESP32 and PlatformIO for the badges.</p>']),
])
resume += '      </div>\n'
write('resume/index.html', page('/resume/', 'Resume', "David Liu's resume. Software engineering at Western, 16 months at J.D. Power, founder of Tethos. Hover anything for more.", resume, 'resume', cls='resume', ))


# ---- Projects -----------------------------------------------------------------

def proj(t, name, meta, line, desc, stack, links, shot, extra_cls=''):
    shot_html = f'        <div class="shot{extra_cls}">{shot}</div>\n' if shot else ''
    return f'''      <article class="proj" id="{t}" data-t="{t}">
{shot_html}        <div class="proj-head"><h2>{name}</h2><span class="t3">{meta}</span></div>
        <p class="t1">{line}</p>
        <p>{desc}</p>
        <p class="stack">{stack}</p>
        <p class="go">{''.join(links)}</p>
      </article>
'''


projects = '''      <header class="doc-head">
        <div>
          <h1>Projects</h1>
          <p class="hint">What I've built, with the stack and the code.</p>
        </div>
        <p class="go"><a class="ln out" href="https://github.com/dahan8473">All of it on GitHub</a></p>
      </header>

      <div class="projs" data-t="build">
'''
projects += proj('tethos-platform', 'Tethos Platform', '2026', 'A member portal you walk around as a 3D island.',
  'Solo-built for 400+ members: a 2.5D multiplayer world with 875+ 3D assets, a 91-species fishing system, and five LLM characters who remember you between visits. Around it, 59 API routes and five tiers of role-based access.',
  'Next.js · React · TypeScript · Supabase · FastAPI · React Three Fiber · Colyseus',
  [link('/dashboard/', 'How the island works'), link('/rag/', 'The RAG service'), ext('https://tethos.ca', 'tethos.ca')],
  img('/media/work/island-overview.webp', 'Tethos Island, the member dashboard, in daylight', 1400, 706))
projects += proj('hackthenorth', 'Among Us, IRL', '1st, Hack the North 2026', 'Real-life Among Us on conference badges.',
  "36 hours, team of three. The badges sync peer to peer over an ESP-NOW mesh with no server or phones, and signal strength decides if you're close enough to kill. I wrote the game, the voting and the NFC task minigames.",
  'C++ · ESP32-C3 · ESP-NOW · PlatformIO',
  [ext('https://github.com/dahan8473/htn-amongus', 'GitHub'), ext('https://devpost.com/software/among-us-lbrwjk', 'Devpost')],
  img('/media/work/htn-badges.webp', 'Two Hack the North badges running Among Us', 1000, 750))
projects += proj('biopilot', 'biopilot', '2nd, TELUS AI', 'Drone footage in, crop-health maps out.',
  'YOLOv8 wheat-head detection, per-cell health scores, and heatmaps you can compare run to run. Won $5,000 at TELUS AI at the Edge of Innovation.',
  'React · TypeScript · Vite · FastAPI · YOLOv8 · deck.gl · MapLibre',
  [ext('https://github.com/dahan8473/biopilot', 'GitHub')],
  img('/media/work/biopilot-heatmap.webp', 'A crop-health heatmap over farm fields', 1200, 750))
projects += proj('kunlun', 'Kunlun', '2026', 'A clothing brand built on Chinese mythology.',
  'Traditional Chinese and English run side by side as two voices. I built the bilingual design system and the storefront. Pre-launch.',
  'Next.js · React · Tailwind · Stripe · Supabase · Resend',
  [link('/kunlun/', 'Case study')],
  img('/media/work/kunlun-liangfeng.webp', 'Kunlun storefront: 涼風, Liangfeng, Cool Wind', 1400, 876), ' ink')
projects += proj('dejaview', 'deja-view', 'Hackathon, 2026', 'The media you watch in, furniture in a 3D scan of your room out.',
  'It scrapes the media you watch, finds furniture you like, and places it in a virtual 3D scan of your room. Pretty dystopian, I know. Team of four.',
  'Next.js · FastAPI · OpenAI · Gemini · Replicate Trellis · Cloudflare R2',
  [ext('https://github.com/dahan8473/deja-view', 'GitHub')],
  img('/media/work/dejaview-landing.webp', 'deja-view landing page', 1400, 748))
projects += proj('snake', 'snake-and-commits', 'Open source', 'Your contribution graph as a game of Snake.',
  'A GitHub Action with BFS pathfinding and no self-collisions, in one standard-library Python file with zero dependencies.',
  'Python · GitHub Actions · SVG',
  [ext('https://github.com/dahan8473/snake-and-commits', 'GitHub')],
  img('/media/work/snake.svg', 'A contribution graph being eaten by a snake', 880, 192), ' svg')
projects += '      </div>\n\n'


def more(t, name, line, stack, links, meta=''):
    attrs = f' data-t="{t}"' if t else ''
    return f'          <li class="row"{attrs}><span class="p">{name}</span><span class="s">{line}<span class="stack">{stack}</span></span><span class="m">{"".join(links)}</span></li>\n'


projects += '''      <section class="more-projs" aria-labelledby="more-h">
        <h2 id="more-h">More</h2>
        <ul class="list">
'''
projects += more('rag-card', 'RAG service', "Cited answers from Tethos's Drive and Notion. Never re-embeds what didn't change.", 'FastAPI · pgvector · OpenAI embeddings · Docker · Cloud Run', [link('/rag/', 'Case study')])
projects += more('ur5', 'UR5 motion library', 'Six programs for a collaborative robot arm, from my Modern Engineering internship.', 'Python · RTDE · OpenCV', [ext('https://github.com/dahan8473/ModernEngineering_UR', 'GitHub')])
projects += more('wec', 'WEC 2024', 'Our 2024 Western Engineering Competition entry.', 'Unity · C#', [ext('https://github.com/dahan8473/WEC_24', 'GitHub')])
projects += more('this-site', 'davidliu.work', 'This site, and the floating head that talks like me.', 'HTML · CSS · JavaScript · DeepSeek · Jev', [ext('https://github.com/dahan8473/dahan8473.github.io', 'GitHub')])
projects += '        </ul>\n      </section>\n'
write('projects/index.html', page('/projects/', 'Projects', 'Projects by David Liu, with the stack and the code: Tethos Platform, Among Us IRL (1st at Hack the North), biopilot, Kunlun, deja-view, snake-and-commits.', projects, 'projects', cls='projects', ))


# ---- Hobbies ------------------------------------------------------------------

# Grouped: the ones with something to show get a row and a line, the rest a
# link under their group. Every hobby has its own page either way.
GROUPS = [
  ('Body', [
    ('muay-thai', 'Muay Thai', 'I train, and coach the beginner class.', None),
    ('climbing', 'Rock climbing', 'Bouldering. V2, for now.', None),
  ], [('swimming', 'Swimming'), ('badminton', 'Badminton'), ('cycling', 'Cycling'), ('hiking', 'Hiking'), ('speed-skating', 'Speed skating')]),
  ('Mind', [
    ('travel', 'Travel', "Beijing, New York, and a list I'm behind on.", None),
    ('fashion', 'Fashion', 'Kunlun, a clothing brand built on Chinese mythology.', '/media/work/kunlun-liangfeng.webp'),
  ], [('chess', 'Chess'), ('drones', 'Flying drones'), ('video', 'Video production')]),
  ('Soul', [
    ('meowmeow', 'Meowmeow', 'My cat. Always chudding around.', '/media/life/meowmeow-sleep.webp'),
    ('guitar', 'Classical guitar', 'Competed nationally, played Carnegie Hall. Four recordings.', None),
    ('photography', 'Photography', 'Fujifilm X-T200 and Sony A7R II.', None),
  ], [('watercolor', 'Watercolor'), ('poetry', 'Poetry')]),
]
# Page order, for previous and next.
HOBBIES = [h[:2] for _, rows, more in GROUPS for h in rows + more]
DT = {'muay-thai': 'muaythai'}

hob = '''      <header class="doc-head">
        <div>
          <h1>Hobbies</h1>
          <p class="hint">Not everything is work. This part is for friends, and for recruiters who made it this far.</p>
        </div>
      </header>

      <div class="hobs" data-t="life">
'''
for label, rows, more in GROUPS:
    hob += f'        <section class="hob-group">\n          <h2>{label}</h2>\n          <ul class="list doors">\n'
    for slug, name, line, photo in rows:
        ph = f' data-photo="{photo}"' if photo else ''
        hob += f'            <li data-t="{DT.get(slug, slug)}"><a class="row" href="/hobbies/{slug}/"{ph}><span class="p">{name}</span><span class="s">{line}</span><span class="m">&#8594;</span></a></li>\n'
    hob += '          </ul>\n'
    links = ''.join(f'<a class="ln" href="/hobbies/{slug}/" data-t="{slug}">{name}</a>' for slug, name in more)
    hob += f'          <p class="hob-more"><span>Also</span><span class="go">{links}</span></p>\n        </section>\n'
hob += '      </div>\n'
write('hobbies/index.html', page('/hobbies/', 'Hobbies', 'What David Liu does outside of work: his cat, travel, classical guitar, photography, fashion, Muay Thai, rock climbing and more.', hob, 'hobbies', cls='hobbies'))


def hobby(slug, name, tagline, sections, shot='', kind='Hobby'):
    i = [h[0] for h in HOBBIES].index(slug)
    prev_h, next_h = HOBBIES[i - 1], HOBBIES[(i + 1) % len(HOBBIES)]
    secs = ''
    for label, entries, t in sections:
        attrs = f' data-t="{t}"' if t else ''
        secs += f'      <section class="section"{attrs}>\n        <p class="label">{label}</p>\n        <div class="entries">\n'
        for head, desc in entries:
            secs += f'          <article class="entry">\n            <div class="role"><p class="org">{head}</p></div>\n            <div class="desc">{desc}</div>\n          </article>\n'
        secs += '        </div>\n      </section>\n\n'
    body = f'''      <header class="header" data-t="{DT.get(slug, slug)}">
        <div class="identity">
          <p class="name">{name}</p>
          <p class="title">{kind}</p>
        </div>
        <p class="tagline">{tagline}</p>
      </header>
{shot}
{secs}      <nav class="next" aria-label="More hobbies">
        <a href="/hobbies/{prev_h[0]}/"><span>Previous</span>{prev_h[1]}</a>
        <a class="to-next" href="/hobbies/{next_h[0]}/"><span>Next</span>{next_h[1]}</a>
      </nav>
'''
    write(f'hobbies/{slug}/index.html', page(f'/hobbies/{slug}/', name, f'{name}, one of David Liu\'s hobbies. {tagline}', body, 'hobbies', cls='case', back=('/hobbies/', 'Hobbies')))


hobby('meowmeow', 'Meowmeow', 'My cat. She/her, black, and always chudding around.', [
  ('Meet her', [('Ask the head', '<p>Tell the floating head you have a pet and it will call her over. She walks in from the edge of the screen and lies down.</p>')], None),
], shot='''      <div class="cats big">
        <img src="/media/life/meowmeow-sleep.webp" alt="Meowmeow, a black cat, asleep in a beanbag" width="750" height="1000">
        <img src="/media/life/meowmeow-belly.webp" alt="Meowmeow on her back with her paws in the air" width="750" height="1000">
        <img src="/media/life/meowmeow-stairs.webp" alt="Meowmeow stretched out on the floor by the stairs" width="750" height="1000">
      </div>
''', kind='The cat')
hobby('guitar', 'Classical guitar', "I've competed nationally and played Carnegie Hall. These are recordings of me playing.", [
  ('Recordings', [('Four pieces', '<div class="tracks" id="guitar-tracks"></div>')], 'guitar'),
  ('Highlights', [('Carnegie Hall', '<p>Performed there.</p>'), ('NW Guitar Competition', '<p>2nd place, classical guitar.</p>')], None),
])
hobby('muay-thai', 'Muay Thai', 'I train at the Muay Thai club at Western, and coach its beginner class.', [
  ('Coaching', [('Beginner class', "<p>I coach the people walking in for the first time. If you train anything, tell the head. It'll want to hear about it.</p>")], None),
])
hobby('climbing', 'Rock climbing', "I boulder. I can only do a V2 right now.", [
  ('Grade', [('V2', "<p>My max, for now. If you climb, tell the head what you can do.</p>")], None),
])
SOON = {
  'chess': ('I play chess.', 'Do you play?'),
  'drones': ('I fly drones.', 'Do you fly?'),
  'video': ('I make videos.', 'Do you make videos?'),
  'watercolor': ('I paint with watercolor.', 'Do you paint?'),
  'poetry': ('I write poetry.', 'Do you write?'),
  'swimming': ('I swim.', 'Do you swim?'),
  'badminton': ('I play badminton.', 'Do you play?'),
  'cycling': ('I cycle.', 'Do you ride?'),
  'hiking': ('I hike.', 'Do you hike?'),
  'speed-skating': ('I speed skate.', 'Do you skate?'),
}
for slug, name in [m for _, _, more in GROUPS for m in more]:
    line, ask = SOON[slug]
    hobby(slug, name, f"{line} Haven't written this page up yet.", [
      ('You', [(ask, "<p>Tell the head. It'll want to hear about it.</p>")], None),
    ])
hobby('photography', 'Photography', 'I shoot on a Fujifilm X-T200 and a Sony A7R II.', [
  ('Gear', [('Fujifilm X-T200', '<p>Mirrorless, APS-C.</p>'), ('Sony A7R II', '<p>Full frame.</p>')], 'gear'),
  ('Photos', [('Still choosing', "<p>I'm picking which ones go up.</p>")], None),
])
hobby('travel', 'Travel', "Places I've been. The list is shorter than the trips.", [
  ('Places', [('Beijing, 2023', '<p>A summer of AI research at Tsinghua University.</p>'), ('New York', '<p>Played Carnegie Hall.</p>')], 'travel'),
])
hobby('fashion', 'Fashion', "I'm building Kunlun, a clothing brand built on Chinese mythology. Traditional Chinese and English run side by side as two voices.", [
  ('Kunlun', [('The brand', '<p>Kunlun is the axis mountain of Chinese myth, and each drop is a step up it. I built the bilingual design system and the storefront. Pre-launch.</p><p class="go"><a class="ln" href="/kunlun/">Kunlun case study</a></p>')], None),
], shot='''      <figure class="case-shot ink">
        <img src="/media/work/kunlun-liangfeng.webp" alt="Kunlun storefront: 涼風, Liangfeng, Cool Wind" width="1400" height="876">
        <figcaption>Drop I, Liangfeng</figcaption>
      </figure>
''')


# ---- Notes --------------------------------------------------------------------

notes = '''      <header class="doc-head">
        <div>
          <h1>Notes</h1>
          <p class="hint">Write a note, then stick it anywhere on the wall. Sign it, or don't. Want it to stay between us? Tell the head.</p>
        </div>
        <p class="go wall-write"><button class="write-btn" type="button">Leave a note</button></p>
      </header>

      <div class="board-wrap">
      <section class="board" data-t="wall" aria-label="The note wall">
        <ul class="board-notes" aria-label="Notes from visitors"></ul>
        <button class="pad" type="button" data-t="note-pad">
          <span class="pad-sheet"></span>
          <span class="pad-sheet"></span>
          <span class="pad-sheet top">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 4.5l4 4L9 19l-5 1 1-5z"/><path d="M13.5 6.5l4 4"/></svg>
            <span class="pad-label">Leave a note here</span>
          </span>
        </button>
      </section>
      </div>
      <p class="board-status" role="status" aria-live="polite"></p>

      <template id="write-note">
        <form class="sticky writing" role="dialog" aria-label="Write a note">
          <label class="sr" for="wall-msg">Your note</label>
          <textarea id="wall-msg" name="message" maxlength="280" placeholder="Write something" required></textarea>
          <label class="sr" for="wall-name">Your name</label>
          <input id="wall-name" name="name" maxlength="40" placeholder="Your name, or leave it blank" autocomplete="name">
          <div class="write-actions"><button type="button" class="cancel">Cancel</button><button type="submit" class="stick">Pick a spot</button></div>
        </form>
      </template>
'''
write('notes/index.html', page('/notes/', 'Notes', 'Leave David Liu a note, signed or anonymous.', notes, 'notes', cls='notes'))


# ---- Messages -----------------------------------------------------------------

messages = '''      <h1 class="sr">Messages</h1>
      <section class="imsg" data-t="inbox" aria-label="Messages with the real David">
        <header class="imsg-top">
          <img class="imsg-avatar" src="/media/me.webp" alt="" width="48" height="48">
          <p class="imsg-name">Real David <span aria-hidden="true">&#8250;</span></p>
        </header>
        <ol class="imsg-thread" aria-live="polite"></ol>
        <form class="imsg-compose">
          <p class="imsg-from"><label for="inbox-name">From:</label><input id="inbox-name" name="name" maxlength="40" placeholder="your name (optional)" autocomplete="name"></p>
          <div class="imsg-pill">
            <label class="sr" for="inbox-text">Message</label>
            <textarea id="inbox-text" name="message" rows="1" maxlength="1000" placeholder="iMessage" required></textarea>
            <button class="imsg-send" type="submit" aria-label="Send"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/></svg></button>
          </div>
        </form>
      </section>
      <p class="imsg-note">This goes straight to my phone. When I reply, it shows up here and the head tells you. Rather email? <a class="ln" href="mailto:davidliu8473@gmail.com" aria-label="Email">davidliu8473@gmail.com</a></p>
'''
write('messages/index.html', page('/messages/', 'Messages', 'Message David Liu directly. It goes to his phone, and his replies show up here.', messages, 'messages', cls='messages'))


# ---- Brain ----------------------------------------------------------------------

brain = '''      <header class="doc-head">
        <div>
          <h1>Second brain</h1>
          <p class="hint">What the head knows about me. Drag it around, click to see what connects, double click to ask about it.</p>
        </div>
        <p class="brain-meta"></p>
      </header>

      <div class="brain" data-t="brain" role="img" aria-label="A graph of everything the head knows about David: projects, leadership, experience, education, hobbies, stories, awards and skills">
        <canvas class="brain-graph"></canvas>
      </div>
'''
write('brain/index.html', page('/brain/', 'Second brain', "The notes the AI version of David Liu thinks with: a condensed copy of his Obsidian vault.", brain, 'brain', cls='brain-page'))


# The hand-written pages share the same assets: keep their versions in step.
for rel in ['tethos/index.html', 'dashboard/index.html', 'rag/index.html', 'kunlun/index.html', '404.html']:
    path = os.path.join(REPO, rel)
    html = open(path, encoding='utf-8').read()
    html = re.sub(r'  <nav class="rail" aria-label="Pages">[\s\S]*?</nav>\n', lambda m: rail(''), html, count=1)
    for asset, v in [('styles.css', V_CSS), ('talk/talk.css', V_TALKCSS), ('site.js', V_JS), ('talk/talk.js', V_TALK)]:
        html = re.sub(r'(/' + re.escape(asset) + r'\?v=)\d+', lambda m: m.group(1) + str(v), html)
    open(path, 'w', encoding='utf-8').write(html)
