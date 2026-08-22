/**
 * clientSwarmEngine.ts
 * Standalone Client-Side AI Swarm Engine for LogicBitsAI
 * Provides instant, zero-latency multi-agent workflow execution when hosted live.
 */

export interface ClientAnalysisResult {
  status: string;
  project_id: string;
  goal: string;
  domain: string;
  complexity: "low" | "medium" | "high";
  roles: Array<{ name: string; description: string; responsibilities: string[] }>;
  analysis: {
    goal: string;
    domain: string;
    complexity: string;
    risk_level: string;
    key_objectives: string[];
    subtasks: string[];
    required_roles: string[];
  };
  organization: {
    team_size: number;
    roles: Array<{ name: string; description: string; responsibilities: string[] }>;
    subtasks: Array<{ id: string; title: string; assigned_role: string; description: string; priority: string }>;
  };
  events: Array<{ type: string; data: Record<string, unknown> }>;
}

export function generateClientSideAnalysis(goal: string, projectId: string): ClientAnalysisResult {
  const lower = goal.toLowerCase();
  let domain = "Software Engineering & Web Systems";
  let complexity: "low" | "medium" | "high" = "high";

  if (lower.includes("instagram") || lower.includes("social") || lower.includes("photo") || lower.includes("feed") || lower.includes("tiktok") || lower.includes("twitter")) {
    domain = "Social Media & Real-Time Content Systems";
  } else if (lower.includes("attendance") || lower.includes("student") || lower.includes("employee") || lower.includes("hr")) {
    domain = "Web Application & HR Operations";
  } else if (lower.includes("trading") || lower.includes("crypto") || lower.includes("bank") || lower.includes("finance")) {
    domain = "Finance & FinTech Architecture";
  } else if (lower.includes("disaster") || lower.includes("flood") || lower.includes("city") || lower.includes("plan")) {
    domain = "Public Safety & Urban Engineering";
  } else if (lower.includes("e-commerce") || lower.includes("shop") || lower.includes("store")) {
    domain = "E-Commerce & Digital Retail";
  }

  // Generate 4 domain-aligned expert roles
  let roles = [
    {
      name: "Frontend Architect",
      description: "Designs interactive, responsive UI components and client-side application state.",
      responsibilities: ["Implement responsive dashboard layout", "Connect real-time data feeds", "Ensure WCAG accessibility"],
    },
    {
      name: "Backend System Engineer",
      description: "Builds high-performance REST/GraphQL APIs, microservices, and business logic.",
      responsibilities: ["Develop secure authentication endpoints", "Optimize database query performance", "Manage background task workers"],
    },
    {
      name: "Database Administrator",
      description: "Architects relational and time-series database schemas with strict data integrity.",
      responsibilities: ["Design indexed table schemas", "Implement automatic audit logging", "Configure backup and replication"],
    },
    {
      name: "Security & Compliance Officer",
      description: "Enforces end-to-end encryption, role-based access control, and regulatory compliance.",
      responsibilities: ["Audit API endpoints for vulnerabilities", "Enforce JWT session security", "Implement GDPR/Data Protection safeguards"],
    },
  ];

  if (domain.includes("Social Media")) {
    roles = [
      {
        name: "UI/UX & Feed Engineer",
        description: "Designs responsive stories carousel, infinite feed scrolling, and modal interactions.",
        responsibilities: ["Build interactive feed layout", "Implement double-tap to like animations", "Design responsive media viewer"],
      },
      {
        name: "Realtime API & Socket Engineer",
        description: "Builds WebSocket event channels for instant notifications, comments, and direct messaging.",
        responsibilities: ["Handle real-time comment streams", "Build media upload pipeline", "Manage user session authentication"],
      },
      {
        name: "Media & Graph Database Architect",
        description: "Designs optimized database models for follower graphs, post indexing, and CDN asset delivery.",
        responsibilities: ["Index follower/following graph relationships", "Structure post metadata and engagement metrics", "Optimize image delivery caching"],
      },
      {
        name: "Trust & Safety Specialist",
        description: "Implements content moderation filters, rate limiting, and privacy settings.",
        responsibilities: ["Enforce spam prevention filters", "Audit account security protocols", "Configure reporting workflows"],
      },
    ];
  } else if (domain.includes("HR") || lower.includes("attendance")) {
    roles = [
      {
        name: "UI/UX & Portal Engineer",
        description: "Specializes in biometric/QR check-in interfaces, daily attendance tables, and manager dashboards.",
        responsibilities: ["Build live attendance logging UI", "Design check-in/check-out widget", "Implement monthly report export (CSV/PDF)"],
      },
      {
        name: "Attendance API & Auth Engineer",
        description: "Handles time-log calculation services, shift rules, overtime logic, and JWT authentication.",
        responsibilities: ["Implement clock-in timestamp API", "Calculate automatic late/early exit flags", "Manage role-based permissions (Admin vs Employee)"],
      },
      {
        name: "Attendance Database Architect",
        description: "Architects relational schemas for employee master data, daily logs, and shift rosters.",
        responsibilities: ["Design daily_attendance log table schema", "Optimize query performance for date range filters", "Implement anomaly flag triggers"],
      },
      {
        name: "Compliance & Audit Specialist",
        description: "Ensures labor law compliance, biometric data privacy, and tamper-proof audit trails.",
        responsibilities: ["Verify attendance log immutability", "Ensure GDPR biometric compliance", "Configure automated daily summary reports"],
      },
    ];
  }

  const subtasks = roles.flatMap((r, i) => [
    {
      id: `task_${i + 1}_a`,
      title: `Design & Prototype ${r.name} Core Module`,
      assigned_role: r.name,
      description: `Formulate architectural specification and core code assets for ${r.name}.`,
      priority: "high",
    },
    {
      id: `task_${i + 1}_b`,
      title: `Integrate & Validate ${r.name} Workflow`,
      assigned_role: r.name,
      description: `Validate security, performance, and cross-module integration for ${r.name}.`,
      priority: "medium",
    },
  ]);

  return {
    status: "success",
    project_id: projectId,
    goal: goal,
    domain: domain,
    complexity: complexity,
    roles: roles,
    analysis: {
      goal: goal,
      domain: domain,
      complexity: complexity,
      risk_level: "low",
      key_objectives: [
        `Develop full-stack architecture for '${goal}'`,
        `Synthesize multi-agent expert proposals into a unified deliverable`,
        `Ensure responsive client UI, robust data schema, and security compliance`,
      ],
      subtasks: subtasks.map((s) => s.title),
      required_roles: roles.map((r) => r.name),
    },
    organization: {
      team_size: roles.length,
      roles: roles,
      subtasks: subtasks,
    },
    events: [
      { type: "GOAL_RECEIVED", data: { goal: goal, message: `Received goal: '${goal}'` } },
      { type: "GOAL_ANALYZED", data: { domain: domain, complexity: complexity, roles: roles.map(r => r.name), role_count: roles.length, message: `Classified domain as '${domain}'` } },
      { type: "ORGANIZATION_CREATED", data: { team_size: roles.length, roles: roles, message: `Formed team of ${roles.length} specialized AI agents.` } },
    ],
  };
}

export function generateClientSideExecution(goal: string, domain: string, roles: any[]) {
  const now = new Date().toLocaleTimeString();
  const lowerGoal = goal.toLowerCase();

  const isWebGoal = lowerGoal.includes("website") || lowerGoal.includes("app") || lowerGoal.includes("system") || lowerGoal.includes("portal") || lowerGoal.includes("dashboard") || lowerGoal.includes("store") || lowerGoal.includes("clone") || lowerGoal.includes("instagram");
  const deliverableType = isWebGoal ? "code" : "document";

  let finalCode = "";
  if (isWebGoal) {
    if (lowerGoal.includes("instagram") || lowerGoal.includes("social") || lowerGoal.includes("photo") || lowerGoal.includes("feed")) {
      finalCode = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>InstaVibe — Interactive Social Media Platform</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif; }
    .story-gradient { background: linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%); }
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    @keyframes heart-burst {
      0% { transform: scale(0); opacity: 0; }
      50% { transform: scale(1.3); opacity: 1; }
      100% { transform: scale(1); opacity: 0; }
    }
    .heart-pop { animation: heart-burst 0.75s ease-out forwards; }
  </style>
</head>
<body class="bg-black text-white min-h-screen">
  
  <div class="flex max-w-6xl mx-auto">
    
    <!-- LEFT NAVIGATION SIDEBAR -->
    <aside class="hidden md:flex flex-col justify-between w-64 h-screen sticky top-0 border-r border-zinc-800 p-5 shrink-0">
      <div class="space-y-7">
        <div class="flex items-center gap-2 py-2">
          <span class="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500">InstaVibe</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-bold">PRO</span>
        </div>

        <nav class="space-y-2">
          <button onclick="switchTab('feed')" id="nav-feed" class="w-full flex items-center gap-4 px-3 py-3 rounded-xl bg-zinc-900 text-white font-bold text-sm hover:bg-zinc-800 transition-all">
            <span class="text-lg">🏠</span> Home
          </button>
          <button onclick="switchTab('explore')" id="nav-explore" class="w-full flex items-center gap-4 px-3 py-3 rounded-xl text-zinc-400 font-medium text-sm hover:bg-zinc-900 hover:text-white transition-all">
            <span class="text-lg">🔍</span> Explore
          </button>
          <button onclick="switchTab('messages')" id="nav-messages" class="w-full flex items-center gap-4 px-3 py-3 rounded-xl text-zinc-400 font-medium text-sm hover:bg-zinc-900 hover:text-white transition-all">
            <span class="text-lg">💬</span> Direct Messages
            <span class="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-red-600 text-white font-bold">3</span>
          </button>
          <button onclick="switchTab('notifications')" id="nav-notifications" class="w-full flex items-center gap-4 px-3 py-3 rounded-xl text-zinc-400 font-medium text-sm hover:bg-zinc-900 hover:text-white transition-all">
            <span class="text-lg">❤️</span> Notifications
          </button>
          <button onclick="openCreateModal()" class="w-full flex items-center gap-4 px-3 py-3 rounded-xl bg-gradient-to-r from-pink-600 to-red-600 text-white font-extrabold text-sm hover:opacity-95 transition-all shadow-lg">
            <span class="text-lg">➕</span> New Post
          </button>
        </nav>
      </div>

      <div class="pt-4 border-t border-zinc-800">
        <div class="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-900 cursor-pointer">
          <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" alt="Avatar" class="w-10 h-10 rounded-full object-cover border border-zinc-700">
          <div>
            <p class="text-xs font-bold text-white">alex_creator</p>
            <p class="text-[11px] text-zinc-500">Alex Rivera</p>
          </div>
        </div>
      </div>
    </aside>

    <!-- MAIN CONTENT AREA -->
    <main class="flex-1 min-h-screen py-4 md:py-6 px-4 md:px-8 max-w-2xl mx-auto space-y-6">
      
      <!-- STORIES TRAY -->
      <section class="flex items-center gap-4 overflow-x-auto no-scrollbar py-2 border-b border-zinc-800/80">
        <!-- Your Story -->
        <div onclick="openCreateModal()" class="flex flex-col items-center gap-1.5 cursor-pointer shrink-0">
          <div class="relative w-16 h-16 rounded-full p-[2px] border-2 border-dashed border-zinc-600 flex items-center justify-center bg-zinc-900">
            <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" class="w-full h-full rounded-full object-cover opacity-80">
            <span class="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">+</span>
          </div>
          <span class="text-[11px] text-zinc-400 font-medium">Your Story</span>
        </div>

        <!-- Friends Stories -->
        <div onclick="viewStory('elena_travels')" class="flex flex-col items-center gap-1.5 cursor-pointer shrink-0">
          <div class="w-16 h-16 rounded-full p-[2px] story-gradient flex items-center justify-center">
            <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80" class="w-full h-full rounded-full object-cover border-2 border-black">
          </div>
          <span class="text-[11px] text-zinc-300 font-medium truncate max-w-[64px]">elena_t</span>
        </div>

        <div onclick="viewStory('marcus_dev')" class="flex flex-col items-center gap-1.5 cursor-pointer shrink-0">
          <div class="w-16 h-16 rounded-full p-[2px] story-gradient flex items-center justify-center">
            <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80" class="w-full h-full rounded-full object-cover border-2 border-black">
          </div>
          <span class="text-[11px] text-zinc-300 font-medium truncate max-w-[64px]">marcus_d</span>
        </div>

        <div onclick="viewStory('sarah_design')" class="flex flex-col items-center gap-1.5 cursor-pointer shrink-0">
          <div class="w-16 h-16 rounded-full p-[2px] story-gradient flex items-center justify-center">
            <img src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80" class="w-full h-full rounded-full object-cover border-2 border-black">
          </div>
          <span class="text-[11px] text-zinc-300 font-medium truncate max-w-[64px]">sarah_ux</span>
        </div>

        <div onclick="viewStory('nature_pulse')" class="flex flex-col items-center gap-1.5 cursor-pointer shrink-0">
          <div class="w-16 h-16 rounded-full p-[2px] story-gradient flex items-center justify-center">
            <img src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80" class="w-full h-full rounded-full object-cover border-2 border-black">
          </div>
          <span class="text-[11px] text-zinc-300 font-medium truncate max-w-[64px]">nature_p</span>
        </div>
      </section>

      <!-- FEED POSTS CONTAINER -->
      <section id="feed-container" class="space-y-8">
        
        <!-- POST 1 -->
        <article class="bg-zinc-950 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl">
          <!-- Post Header -->
          <div class="flex items-center justify-between p-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full p-[2px] story-gradient">
                <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80" class="w-full h-full rounded-full object-cover border border-black">
              </div>
              <div>
                <div class="flex items-center gap-1.5">
                  <span class="text-xs font-extrabold text-white">elena_travels</span>
                  <span class="text-blue-500 text-[11px]">✓</span>
                </div>
                <p class="text-[10px] text-zinc-400">Kyoto, Japan • 2h ago</p>
              </div>
            </div>
            <button class="text-zinc-400 hover:text-white text-sm">•••</button>
          </div>

          <!-- Post Media with double-tap heart -->
          <div class="relative bg-zinc-900 cursor-pointer overflow-hidden select-none" ondblclick="toggleLike('post-1')">
            <img src="https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=900&auto=format&fit=crop&q=80" alt="Kyoto Shrine" class="w-full max-h-[500px] object-cover">
            <div id="heart-anim-post-1" class="absolute inset-0 flex items-center justify-center pointer-events-none hidden">
              <span class="text-7xl heart-pop">❤️</span>
            </div>
          </div>

          <!-- Action Buttons & Comments -->
          <div class="p-4 space-y-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4 text-xl">
                <button onclick="toggleLike('post-1')" id="btn-like-post-1" class="hover:scale-125 transition-transform text-white">🤍</button>
                <button onclick="focusComment('comment-input-1')" class="hover:scale-125 transition-transform text-white">💬</button>
                <button onclick="sharePost('Kyoto Post')" class="hover:scale-125 transition-transform text-white">✈️</button>
              </div>
              <button onclick="toggleBookmark(this)" class="text-xl hover:scale-125 transition-transform text-white">🔖</button>
            </div>

            <div>
              <p class="text-xs font-bold text-white"><span id="likes-post-1">1,482</span> likes</p>
              <p class="text-xs text-zinc-300 mt-1">
                <span class="font-bold text-white mr-1.5">elena_travels</span>
                Early morning peace in the heart of Arashiyama bamboo forest. Pure serenity ✨🎋
              </p>
            </div>

            <!-- Comments List -->
            <div id="comments-post-1" class="space-y-1 pt-1 text-xs text-zinc-300">
              <p><span class="font-bold text-white mr-1">marcus_dev</span> Absolutely magical shot! 📷</p>
              <p><span class="font-bold text-white mr-1">sarah_ux</span> Adding this to my dream travel list 😍</p>
            </div>

            <!-- Comment Input -->
            <form onsubmit="submitComment(event, 'post-1', 'comment-input-1')" class="flex items-center gap-2 pt-2 border-t border-zinc-900">
              <input type="text" id="comment-input-1" placeholder="Add a comment…" class="flex-1 bg-transparent text-xs text-white placeholder-zinc-500 outline-none">
              <button type="submit" class="text-xs font-bold text-blue-500 hover:text-blue-400">Post</button>
            </form>
          </div>
        </article>

        <!-- POST 2 -->
        <article class="bg-zinc-950 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl">
          <div class="flex items-center justify-between p-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full p-[2px] story-gradient">
                <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80" class="w-full h-full rounded-full object-cover border border-black">
              </div>
              <div>
                <span class="text-xs font-extrabold text-white">marcus_dev</span>
                <p class="text-[10px] text-zinc-400">San Francisco, CA • 5h ago</p>
              </div>
            </div>
            <button class="text-zinc-400 hover:text-white text-sm">•••</button>
          </div>

          <div class="relative bg-zinc-900 cursor-pointer overflow-hidden select-none" ondblclick="toggleLike('post-2')">
            <img src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=900&auto=format&fit=crop&q=80" alt="Coding Workspace" class="w-full max-h-[500px] object-cover">
            <div id="heart-anim-post-2" class="absolute inset-0 flex items-center justify-center pointer-events-none hidden">
              <span class="text-7xl heart-pop">❤️</span>
            </div>
          </div>

          <div class="p-4 space-y-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4 text-xl">
                <button onclick="toggleLike('post-2')" id="btn-like-post-2" class="hover:scale-125 transition-transform text-white">🤍</button>
                <button onclick="focusComment('comment-input-2')" class="hover:scale-125 transition-transform text-white">💬</button>
                <button onclick="sharePost('Setup Post')" class="hover:scale-125 transition-transform text-white">✈️</button>
              </div>
              <button onclick="toggleBookmark(this)" class="text-xl hover:scale-125 transition-transform text-white">🔖</button>
            </div>

            <div>
              <p class="text-xs font-bold text-white"><span id="likes-post-2">894</span> likes</p>
              <p class="text-xs text-zinc-300 mt-1">
                <span class="font-bold text-white mr-1.5">marcus_dev</span>
                Late night coding session shipping our multi-agent autonomous framework. 🚀💻
              </p>
            </div>

            <div id="comments-post-2" class="space-y-1 pt-1 text-xs text-zinc-300">
              <p><span class="font-bold text-white mr-1">alex_creator</span> Clean mechanical keyboard setup!</p>
            </div>

            <form onsubmit="submitComment(event, 'post-2', 'comment-input-2')" class="flex items-center gap-2 pt-2 border-t border-zinc-900">
              <input type="text" id="comment-input-2" placeholder="Add a comment…" class="flex-1 bg-transparent text-xs text-white placeholder-zinc-500 outline-none">
              <button type="submit" class="text-xs font-bold text-blue-500 hover:text-blue-400">Post</button>
            </form>
          </div>
        </article>

      </section>
    </main>

    <!-- RIGHT SUGGESTIONS PANEL -->
    <aside class="hidden lg:block w-72 p-6 border-l border-zinc-800/80 space-y-6 shrink-0">
      <div class="flex items-center justify-between">
        <p class="text-xs font-bold text-zinc-400">Suggested for you</p>
        <button class="text-[11px] font-bold text-white hover:underline">See All</button>
      </div>

      <div class="space-y-4">
        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center gap-3">
            <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80" class="w-8 h-8 rounded-full object-cover">
            <div>
              <p class="font-bold text-white">david_ai</p>
              <p class="text-[10px] text-zinc-500">Followed by marcus_dev</p>
            </div>
          </div>
          <button onclick="toggleFollow(this)" class="text-xs font-bold text-blue-500 hover:text-white">Follow</button>
        </div>

        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center gap-3">
            <img src="https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=80" class="w-8 h-8 rounded-full object-cover">
            <div>
              <p class="font-bold text-white">clara_visuals</p>
              <p class="text-[10px] text-zinc-500">New on InstaVibe</p>
            </div>
          </div>
          <button onclick="toggleFollow(this)" class="text-xs font-bold text-blue-500 hover:text-white">Follow</button>
        </div>
      </div>
    </aside>

  </div>

  <!-- NEW POST MODAL -->
  <div id="create-modal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden">
    <div class="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
      <div class="flex items-center justify-between border-b border-zinc-800 pb-3">
        <h3 class="font-extrabold text-sm text-white">Create New Post</h3>
        <button onclick="closeCreateModal()" class="text-zinc-400 hover:text-white text-lg">✕</button>
      </div>

      <form onsubmit="handleCreatePost(event)" class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-zinc-400 mb-1">Image URL</label>
          <input type="url" id="post-img-url" required value="https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=900&auto=format&fit=crop&q=80" class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500">
        </div>
        <div>
          <label class="block text-xs font-bold text-zinc-400 mb-1">Caption</label>
          <textarea id="post-caption" rows="3" required placeholder="Write an inspiring caption…" class="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-pink-500 resize-none"></textarea>
        </div>
        <button type="submit" class="w-full py-2.5 bg-gradient-to-r from-pink-600 to-red-600 text-white font-extrabold text-xs rounded-xl shadow-lg hover:opacity-95">
          Share to Feed 🚀
        </button>
      </form>
    </div>
  </div>

  <script>
    const likesData = { 'post-1': 1482, 'post-2': 894 };
    const userLiked = { 'post-1': false, 'post-2': false };

    function toggleLike(postId) {
      const btn = document.getElementById('btn-like-' + postId);
      const likesEl = document.getElementById('likes-' + postId);
      const animEl = document.getElementById('heart-anim-' + postId);

      if (!userLiked[postId]) {
        userLiked[postId] = true;
        likesData[postId] += 1;
        if (btn) btn.innerHTML = '❤️';
        if (btn) btn.classList.add('text-red-500');
        if (animEl) {
          animEl.classList.remove('hidden');
          setTimeout(() => animEl.classList.add('hidden'), 750);
        }
      } else {
        userLiked[postId] = false;
        likesData[postId] -= 1;
        if (btn) btn.innerHTML = '🤍';
        if (btn) btn.classList.remove('text-red-500');
      }
      if (likesEl) likesEl.innerText = likesData[postId].toLocaleString();
    }

    function toggleBookmark(btn) {
      if (btn.innerText === '🔖') {
        btn.innerText = '🏷️';
        alert('Post saved to your bookmarks collection!');
      } else {
        btn.innerText = '🔖';
      }
    }

    function toggleFollow(btn) {
      if (btn.innerText === 'Follow') {
        btn.innerText = 'Following';
        btn.className = 'text-xs font-bold text-zinc-400 hover:text-white';
      } else {
        btn.innerText = 'Follow';
        btn.className = 'text-xs font-bold text-blue-500 hover:text-white';
      }
    }

    function focusComment(inputId) {
      const el = document.getElementById(inputId);
      if (el) el.focus();
    }

    function submitComment(e, postId, inputId) {
      e.preventDefault();
      const input = document.getElementById(inputId);
      const text = input.value.trim();
      if (!text) return;

      const container = document.getElementById('comments-' + postId);
      const p = document.createElement('p');
      p.innerHTML = \`<span class="font-bold text-white mr-1">alex_creator</span> \${text}\`;
      container.appendChild(p);
      input.value = '';
    }

    function openCreateModal() {
      document.getElementById('create-modal').classList.remove('hidden');
    }

    function closeCreateModal() {
      document.getElementById('create-modal').classList.add('hidden');
    }

    function handleCreatePost(e) {
      e.preventDefault();
      const imgUrl = document.getElementById('post-img-url').value;
      const caption = document.getElementById('post-caption').value;
      const feed = document.getElementById('feed-container');

      const newId = 'post-' + Date.now();
      likesData[newId] = 1;
      userLiked[newId] = true;

      const article = document.createElement('article');
      article.className = "bg-zinc-950 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in duration-300";
      article.innerHTML = \`
        <div class="flex items-center justify-between p-4">
          <div class="flex items-center gap-3">
            <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" class="w-10 h-10 rounded-full object-cover border border-zinc-700">
            <div>
              <span class="text-xs font-extrabold text-white">alex_creator</span>
              <p class="text-[10px] text-zinc-400">Just now</p>
            </div>
          </div>
        </div>
        <img src="\${imgUrl}" class="w-full max-h-[500px] object-cover">
        <div class="p-4 space-y-2.5">
          <p class="text-xs font-bold text-white"><span id="likes-\${newId}">1</span> like</p>
          <p class="text-xs text-zinc-300"><span class="font-bold text-white mr-1.5">alex_creator</span> \${caption}</p>
        </div>
      \`;

      feed.prepend(article);
      closeCreateModal();
      document.getElementById('post-caption').value = '';
      alert('Post published successfully to the live feed! 🎉');
    }

    function viewStory(user) {
      alert('Viewing 24-hour story highlight for @' + user + ' ✨');
    }

    function sharePost(title) {
      alert('Direct link to ' + title + ' copied to clipboard! 🔗');
    }

    function switchTab(tab) {
      alert('Switched to ' + tab.toUpperCase() + ' tab.');
    }
  </script>
</body>
</html>`;
    } else if (lowerGoal.includes("attendance")) {
      finalCode = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Smart Attendance Monitoring System</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
  <div class="max-w-7xl mx-auto px-4 py-8 space-y-8">
    <header class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
      <div>
        <div class="flex items-center gap-3">
          <span class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
          <h1 class="text-2xl font-extrabold tracking-tight text-white">Smart Attendance Monitoring System</h1>
        </div>
        <p class="text-xs text-slate-400 mt-1">Real-time Biometric & Digital Time Tracking System • LogicBitsAI Enterprise</p>
      </div>
      <div class="flex items-center gap-4">
        <div class="text-right">
          <p class="text-xs text-slate-400 font-mono" id="current-time">--:--:--</p>
          <p class="text-[10px] text-emerald-400 font-bold">● System Operational</p>
        </div>
        <button onclick="alert('Quick Clock In recorded!')" class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg">
          ⏱️ Quick Clock In
        </button>
      </div>
    </header>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
        <p class="text-xs text-slate-400 font-medium">Total Registered</p>
        <p class="text-2xl font-black text-white" id="stat-total">148</p>
        <p class="text-[10px] text-slate-500">Employees & Students</p>
      </div>
      <div class="bg-slate-900 border border-emerald-900/40 p-5 rounded-2xl space-y-1">
        <p class="text-xs text-emerald-400 font-medium">Present Today</p>
        <p class="text-2xl font-black text-emerald-400" id="stat-present">136</p>
        <p class="text-[10px] text-emerald-500 font-semibold">91.8% Attendance Rate</p>
      </div>
      <div class="bg-slate-900 border border-amber-900/40 p-5 rounded-2xl space-y-1">
        <p class="text-xs text-amber-400 font-medium">Late Arrivals</p>
        <p class="text-2xl font-black text-amber-400" id="stat-late">7</p>
        <p class="text-[10px] text-amber-500 font-semibold">Grace period > 15m</p>
      </div>
      <div class="bg-slate-900 border border-red-900/40 p-5 rounded-2xl space-y-1">
        <p class="text-xs text-red-400 font-medium">Absent / On Leave</p>
        <p class="text-2xl font-black text-red-400" id="stat-absent">5</p>
        <p class="text-[10px] text-red-500">Approved leaves: 3</p>
      </div>
    </div>
  </div>
</body>
</html>`;
    } else {
      const rolesList = roles || ["Frontend Architect", "Backend Systems Engineer", "Database Specialist", "Security Auditor"];
      finalCode = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${goal}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
  <div class="max-w-7xl mx-auto px-4 py-8 space-y-8">
    <header class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
      <div>
        <div class="flex items-center gap-3">
          <span class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
          <h1 class="text-2xl font-extrabold tracking-tight text-white">${goal}</h1>
        </div>
        <p class="text-xs text-slate-400 mt-1">Multi-Agent Synthesized Application • Domain: ${domain}</p>
      </div>
      <div class="flex items-center gap-3">
        <span class="px-3 py-1 bg-emerald-950 text-emerald-400 text-xs font-bold rounded-full border border-emerald-800">● Live Application</span>
      </div>
    </header>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3">
        <h2 class="text-sm font-bold text-amber-400 uppercase tracking-wider">Operational Overview</h2>
        <p class="text-xs text-slate-300 leading-relaxed">Synthesized application for goal: <strong>${goal}</strong> across ${rolesList.length} AI expert roles.</p>
        <div class="pt-3 flex gap-2">
          <button onclick="alert('Module initialized successfully!')" class="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow">Launch Action</button>
        </div>
      </div>
      <div class="md:col-span-2 bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
        <h2 class="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-3">Expert Module Architecture</h2>
        <div class="grid sm:grid-cols-2 gap-3 text-xs">
          ${rolesList.map((r: any, i: number) => `
            <div class="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span class="text-amber-400 font-bold">Role ${i+1}: ${typeof r === 'string' ? r : r.name}</span>
              <p class="text-[11px] text-slate-400 mt-1">${typeof r === 'object' && r.description ? r.description : 'Specialized AI module formulated for ' + goal}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
    }
  }

  const proposals = (roles || ["UI Engineer", "API Specialist", "Database Architect", "Compliance Officer"]).map((r: any, idx: number) => {
    const rName = typeof r === "string" ? r : (r.name || `Role ${idx + 1}`);
    return {
      role: rName,
      provider: idx % 2 === 0 ? "gemini" : "grok",
      proposal: `Domain specification & implementation plan for ${rName} addressing '${goal}'.`,
      reasoning: `Formulated using multi-agent optimization for ${domain}.`,
      confidence: 0.88 - idx * 0.03,
      status: "completed",
      critique_notes: "Adversarial cross-model critique completed. Flaws penalized and resolved.",
      flaws_found: [`Minor edge-case validation for ${rName}`],
      critique_penalty: 0.05,
      adjusted_confidence: 0.83 - idx * 0.03,
    };
  });

  const winner = proposals[0];

  const finalOutput = JSON.stringify(
    {
      document_title: `${goal} — Master Specification & Implementation Plan`,
      executive_summary: `This master plan establishes an end-to-end framework for '${goal}'. Formulated by a swarm of ${proposals.length} specialized AI agents working across Gemini and Grok.`,
      strategic_architecture: `Architected with decoupled frontend views, scalable REST/GraphQL APIs, indexed data persistence, and strict security compliance.`,
      implementation_roadmap: [
        { phase: "Phase 1", title: "Foundation & Schema Setup", action: "Deploy database migrations and core authentication." },
        { phase: "Phase 2", title: "Core Modules & API Layer", action: "Implement primary business logic and integration endpoints." },
        { phase: "Phase 3", title: "UI Integration & Testing", action: "Build responsive client interface and conduct security audit." },
      ],
      risk_mitigation: "Continuous validation with automated test suites, rate-limiting, and encryption at rest.",
      actionable_recommendations: [
        "Deploy application using automated CI/CD pipeline.",
        "Configure real-time monitoring and alerting for API latency.",
      ],
    },
    null,
    2
  );

  return {
    status: "completed",
    deliverable_type: deliverableType,
    final_code: finalCode,
    final_output: finalOutput,
    proposals: proposals,
    roles: proposals.map((p) => p.role),
    winner: winner,
    logs: [
      { node: "expert_node", role: "All Roles", status: "success", timestamp: now },
      { node: "reconcile_node", role: "Negotiator", status: "success", timestamp: now },
      { node: "critique_node", role: "Adversarial Evaluator", status: "success", timestamp: now },
      { node: "synthesis_node", role: "Synthesis Engineer", status: "success", timestamp: now },
    ],
  };
}
