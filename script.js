
/**
 * Pranav K | Cloud & Serverless Portfolio
 * Modern, Interactive Frontend Script
 */

const API_URL = "https://90y9wzfm46tg51xd.qws.lambda-web.ap-south-1.on.aws/api/contact";
const PROJECTS_API_URL = "https://90y9wzfm46tg51xd.qws.lambda-web.ap-south-1.on.aws/api/projects";

document.addEventListener('DOMContentLoaded', () => {
  initParticleCanvas();
  initTypingEffect();
  initTelemetryStream();
  initInteractiveTerminal();
  initContactForm();
  initNavigation();
  initCopyEmail();
  displayPortfolioProjects();
});


/* ==========================================================================
   1. INTERACTIVE CONSTELLATION / CLOUD MESH CANVAS
   ========================================================================== */
function initParticleCanvas() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const mouse = { x: null, y: null, maxDist: 140 };

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  window.addEventListener('mouseleave', () => {
    mouse.x = null;
    mouse.y = null;
  });

  const particleCount = Math.min(Math.floor((width * height) / 16000), 75);
  const particles = [];

  class Particle {
    constructor() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.vx = (Math.random() - 0.5) * 0.6;
      this.vy = (Math.random() - 0.5) * 0.6;
      this.radius = Math.random() * 2 + 1;
      this.color = Math.random() > 0.4 ? 'rgba(255, 153, 0,' : 'rgba(0, 242, 254,';
      this.baseAlpha = Math.random() * 0.4 + 0.2;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;

      if (this.x < 0 || this.x > width) this.vx *= -1;
      if (this.y < 0 || this.y > height) this.vy *= -1;

      if (mouse.x !== null && mouse.y !== null) {
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.maxDist) {
          const force = (mouse.maxDist - dist) / mouse.maxDist;
          this.x -= (dx / dist) * force * 1.5;
          this.y -= (dy / dist) * force * 1.5;
        }
      }
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = `${this.color} ${this.baseAlpha})`;
      ctx.fill();
    }
  }

  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 120) {
          const alpha = (1 - dist / 120) * 0.2;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      }
    }

    if (mouse.x !== null && mouse.y !== null) {
      for (let i = 0; i < particles.length; i++) {
        const dx = mouse.x - particles[i].x;
        const dy = mouse.y - particles[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < mouse.maxDist) {
          const alpha = (1 - dist / mouse.maxDist) * 0.35;
          ctx.beginPath();
          ctx.moveTo(mouse.x, mouse.y);
          ctx.lineTo(particles[i].x, particles[i].y);
          ctx.strokeStyle = `rgba(255, 153, 0, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    particles.forEach((p) => {
      p.update();
      p.draw();
    });

    requestAnimationFrame(animate);
  }

  animate();
}


/* ==========================================================================
   2. HERO DYNAMIC TYPING EFFECT
   ========================================================================== */
function initTypingEffect() {
  const target = document.getElementById('typingText');
  if (!target) return;

  const roles = [
    'Cloud Computing Student',
    'AWS Serverless Builder',
    'Python & Cloud Automation',
    'Aspiring Solutions Architect'
  ];

  let roleIdx = 0;
  let charIdx = 0;
  let isDeleting = false;
  const typeSpeed = 70;
  const deleteSpeed = 35;
  const pauseTime = 1800;

  function type() {
    const currentRole = roles[roleIdx];

    if (!isDeleting) {
      target.textContent = currentRole.substring(0, charIdx + 1);
      charIdx++;
      if (charIdx === currentRole.length) {
        isDeleting = true;
        setTimeout(type, pauseTime);
        return;
      }
      setTimeout(type, typeSpeed);
    } else {
      target.textContent = currentRole.substring(0, charIdx - 1);
      charIdx--;
      if (charIdx === 0) {
        isDeleting = false;
        roleIdx = (roleIdx + 1) % roles.length;
        setTimeout(type, 350);
        return;
      }
      setTimeout(type, deleteSpeed);
    }
  }

  type();
}


/* ==========================================================================
   3. HERO TELEMETRY STREAM LOGS
   ========================================================================== */
function initTelemetryStream() {
  const container = document.getElementById('codeStream');
  if (!container) return;

  const logs = [
    [
      '[INFO] POST /contact received via API Gateway',
      '[200] Lambda executed successfully',
      '[SUCCESS] Record persisted to DynamoDB table: "pranav-contact-messages"'
    ],
    [
      '[S3-EVENT] Website assets served through CloudFront',
      '[CLOUDFRONT] HTTPS request delivered from edge location',
      '[STATUS] Static portfolio frontend operational'
    ],
    [
      '[IAM] Lambda execution role verified',
      '[DYNAMODB] PutItem operation completed',
      '[HEALTHCHECK] Serverless contact pipeline operational'
    ]
  ];

  let currentSet = 0;

  setInterval(() => {
    currentSet = (currentSet + 1) % logs.length;
    container.style.opacity = '0';
    setTimeout(() => {
      container.innerHTML = logs[currentSet]
        .map((line, idx) => {
          if (idx === 2) return `<code><span style="color:#34d399;">${escapeHTML(line)}</span></code>`;
          if (idx === 1) return `<code><span style="color:#60a5fa;">${escapeHTML(line)}</span></code>`;
          return `<code>${escapeHTML(line)}</code>`;
        })
        .join('');
      container.style.opacity = '1';
    }, 250);
  }, 4000);
}


/* ==========================================================================
   4. INTERACTIVE TERMINAL PLAYGROUND
   ========================================================================== */
function initInteractiveTerminal() {
  const input = document.getElementById('terminalInput');
  const output = document.getElementById('terminalOutput');
  const clearBtn = document.getElementById('clearTerminalBtn');

  if (!input || !output) return;

  const history = [];
  let historyIdx = -1;

  const commands = {
    help: () => `
<span class="text-cyan">Available commands:</span>
  <span class="term-highlight">about</span>      - Learn about Pranav
  <span class="term-highlight">skills</span>     - View technical skills
  <span class="term-highlight">projects</span>   - View featured projects
  <span class="term-highlight">aws</span>        - Simulate AWS identity
  <span class="term-highlight">contact</span>    - Contact details
  <span class="term-highlight">whoami</span>     - Current visitor
  <span class="term-highlight">clear</span>      - Clear terminal
    `,
    about: () => `
<span class="text-amber">Pranav K</span> - Cloud Computing Student & AWS Enthusiast.
Building serverless applications with AWS Lambda, API Gateway, and DynamoDB.
    `,
    skills: () => `
<span class="text-cyan">Cloud Stack:</span> AWS Lambda, S3, DynamoDB, API Gateway, IAM, CloudWatch
<span class="text-cyan">Languages:</span> Python, JavaScript, HTML, CSS
    `,
    projects: () => `
1. <span class="text-amber">Serverless Contact Pipeline</span>: API Gateway -> Lambda -> DynamoDB
2. <span class="text-amber">AWS Portfolio Website</span>: S3 + CloudFront
    `,
    aws: () => `
<span class="text-green">{</span>
  "Region": "ap-south-1",
  "Service": "API Gateway + Lambda + DynamoDB",
  "Status": "ACTIVE"
<span class="text-green">}</span>
    `,
    contact: () => `
Email: <a href="mailto:pranav.cloud@example.com" class="text-cyan">pranav.cloud@example.com</a>
LinkedIn: <a href="https://linkedin.com" target="_blank" class="text-cyan">linkedin.com/in/pranav-cloud</a>
GitHub: <a href="https://github.com" target="_blank" class="text-cyan">github.com/pranav-cloud</a>
    `,
    whoami: () => `<span class="text-cyan">guest-visitor</span>`,
    date: () => new Date().toUTCString(),
    clear: () => {
      output.innerHTML = '';
      return '';
    }
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const rawCmd = input.value.trim();
      if (!rawCmd) return;

      history.push(rawCmd);
      historyIdx = history.length;

      const [cmd, ...args] = rawCmd.toLowerCase().split(' ');

      const line = document.createElement('div');
      line.className = 'term-line';
      line.innerHTML = `<span class="term-cmd-echo"><span class="prompt-user">pranav@aws</span>:<span class="prompt-path">~</span>$ <span class="echo-text">${escapeHTML(rawCmd)}</span></span>`;

      let responseHTML = '';
      if (cmd === 'clear') {
        output.innerHTML = '';
        input.value = '';
        return;
      } else if (commands[cmd]) {
        responseHTML = commands[cmd](args);
      } else {
        responseHTML = `<span style="color:#ef4444;">command not found: ${escapeHTML(cmd)}. Type <span class="term-highlight">help</span>.</span>`;
      }

      if (responseHTML) {
        const respDiv = document.createElement('div');
        respDiv.className = 'term-output';
        respDiv.innerHTML = responseHTML;
        line.appendChild(respDiv);
      }

      output.appendChild(line);
      input.value = '';
      output.scrollTop = output.scrollHeight;
    } else if (e.key === 'ArrowUp') {
      if (historyIdx > 0) {
        historyIdx--;
        input.value = history[historyIdx];
      }
    } else if (e.key === 'ArrowDown') {
      if (historyIdx < history.length - 1) {
        historyIdx++;
        input.value = history[historyIdx];
      } else {
        historyIdx = history.length;
        input.value = '';
      }
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      output.innerHTML = `
        <div class="term-line welcome-line">
          <span class="text-amber">Console cleared.</span> Type <span class="term-highlight">help</span> to explore.
        </div>
      `;
    });
  }
}


/* ==========================================================================
   5. CONTACT FORM & REAL AWS SERVERLESS API
   ========================================================================== */
function initContactForm() {
  const form = document.getElementById('contactForm');
  const statusBox = document.getElementById('status');
  const submitBtn = document.getElementById('submitBtn');

  if (!form || !statusBox || !submitBtn) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const subject = document.getElementById('subject').value.trim() || 'General Inquiry';
    const message = document.getElementById('message').value.trim();

    if (!name || !email || !message) {
      showStatus('Please fill in all required fields.', 'error');
      return;
    }

    const requestData = {
      name: name,
      email: email,
      subject: subject,
      message: message
    };

    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');

    submitBtn.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (btnLoader) btnLoader.style.display = 'inline-flex';

    statusBox.className = 'status-box info';
    statusBox.innerHTML = 'Sending your message through AWS...';
    statusBox.style.display = 'block';

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      const result = await response.json();

      if (response.ok) {
        showStatus(`
          <strong>✓ Message sent successfully!</strong><br>
          Thank you, ${escapeHTML(name)}. Your message has been stored in AWS DynamoDB.
        `, 'success');

        form.reset();
        showToast('Message sent to Pranav!');
      } else {
        showStatus(`
          <strong>Message failed.</strong><br>
          ${escapeHTML(result.message || 'Please try again later.')}
        `, 'error');
      }

    } catch (error) {
      showStatus(`
        <strong>Network error.</strong><br>
        Unable to reach the AWS API. Please try again later.
      `, 'error');
    } finally {
      submitBtn.disabled = false;
      if (btnText) btnText.style.display = 'inline-flex';
      if (btnLoader) btnLoader.style.display = 'none';
    }
  });

  function showStatus(html, type) {
    statusBox.className = `status-box ${type}`;
    statusBox.innerHTML = html;
    statusBox.style.display = 'block';
  }
}


/* ==========================================================================
   6. NAVIGATION & MOBILE TOGGLE
   ========================================================================== */
function initNavigation() {
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');
  const navLinks = document.querySelectorAll('.nav-link');

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      navMenu.classList.toggle('open');
    });

    navLinks.forEach((link) => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
      });
    });
  }

  const sections = document.querySelectorAll('section[id]');
  window.addEventListener('scroll', () => {
    let current = '';
    const scrollY = window.pageYOffset;

    sections.forEach((section) => {
      const sectionHeight = section.offsetHeight;
      const sectionTop = section.offsetTop - 120;
      if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach((link) => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${current}`) {
        link.classList.add('active');
      }
    });
  });
}


/* ==========================================================================
   7. COPY EMAIL & TOAST
   ========================================================================== */
function initCopyEmail() {
  const copyBtn = document.getElementById('copyEmailBtn');
  if (!copyBtn) return;

  copyBtn.addEventListener('click', () => {
    const email = copyBtn.getAttribute('data-email') || 'pranav.cloud@example.com';
    navigator.clipboard.writeText(email).then(() => {
      const label = copyBtn.querySelector('.btn-copy-label');
      if (label) {
        const originalText = label.textContent;
        label.textContent = 'Copied!';
        setTimeout(() => {
          label.textContent = originalText;
        }, 2000);
      }
      showToast('Email address copied to clipboard!');
    }).catch(() => {
      showToast('Email: pranav.cloud@example.com');
    });
  });
}

function showToast(message) {
  const toast = document.getElementById('toastNotification');
  if (!toast) return;

  toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#ff9900;"></i> <span>${escapeHTML(message)}</span>`;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g,
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Fetch portfolio projects from AWS Lambda and DynamoDB
async function fetchPortfolioProjects() {
  try {
    const response = await fetch(PROJECTS_API_URL);

    if (!response.ok) {
      throw new Error("Projects API returned HTTP " + response.status);
    }

    const data = await response.json();
    console.log("AWS DynamoDB Projects:", data.projects);

    return data.projects;
  } catch (error) {
    console.error("Failed to fetch portfolio projects:", error);
    return [];
  }
}

/* ==========================================================================
   8. DYNAMIC DYNAMODB PROJECT CARDS
   Keeps all existing Antigravity cards and uses their existing CSS classes.
   ========================================================================== */
async function displayPortfolioProjects() {
  const grid = document.getElementById('projects-grid');
  if (!grid) {
    console.warn('Projects grid not found; skipping dynamic projects.');
    return;
  }

  const projects = await fetchPortfolioProjects();
  if (!Array.isArray(projects)) {
    console.warn('Projects API did not return an array.');
    return;
  }

  // Remove only previously generated cards, never the original HTML cards.
  grid.querySelectorAll('[data-dynamodb-project="true"]').forEach(card => card.remove());

  projects.forEach(project => {
    if (!project || typeof project !== 'object') return;

    const card = document.createElement('article');
    card.className = 'glass-card project-card';
    card.dataset.dynamodbProject = 'true';

    const banner = document.createElement('div');
    banner.className = 'project-banner project-banner-aws';

    const category = document.createElement('div');
    category.className = 'project-tag-pill';
    category.textContent = 'AWS Serverless';

    const bannerIcon = document.createElement('div');
    bannerIcon.className = 'banner-icon';
    const cloudIcon = document.createElement('i');
    cloudIcon.className = 'fa-solid fa-cloud';
    cloudIcon.setAttribute('aria-hidden', 'true');
    bannerIcon.appendChild(cloudIcon);
    banner.append(category, bannerIcon);

    const content = document.createElement('div');
    content.className = 'project-content';

    const title = document.createElement('h3');
    title.className = 'project-title';
    title.textContent = typeof project.title === 'string' && project.title.trim()
      ? project.title
      : 'Untitled Project';

    const description = document.createElement('p');
    description.className = 'project-desc';
    description.textContent = typeof project.description === 'string'
      ? project.description
      : '';

    const tags = document.createElement('div');
    tags.className = 'project-tech-tags';
    if (Array.isArray(project.technologies)) {
      project.technologies.forEach(technology => {
        if (typeof technology !== 'string') return;
        const tag = document.createElement('span');
        tag.textContent = technology;
        tags.appendChild(tag);
      });
    }

    const actions = document.createElement('div');
    actions.className = 'project-actions';
    const githubUrl = typeof project.githubUrl === 'string'
      ? project.githubUrl.trim()
      : '';

    // Only allow a genuine HTTPS GitHub link from API data.
    let validGithubUrl = null;
    try {
      const parsed = new URL(githubUrl);
      if (parsed.protocol === 'https:' &&
          (parsed.hostname === 'github.com' || parsed.hostname === 'www.github.com')) {
        validGithubUrl = parsed.href;
      }
    } catch (error) {
      // Missing or invalid links simply won't create a Source button.
    }

    if (validGithubUrl) {
      const link = document.createElement('a');
      link.href = validGithubUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'project-link';
      link.setAttribute('aria-label', `GitHub Repo: ${title.textContent}`);
      const githubIcon = document.createElement('i');
      githubIcon.className = 'fa-brands fa-github';
      githubIcon.setAttribute('aria-hidden', 'true');
      link.append(githubIcon, document.createTextNode(' Source'));
      actions.appendChild(link);
    }

    content.append(title, description, tags, actions);
    card.append(banner, content);
    grid.appendChild(card);
  });
}
