const sampleBrand = {
  brandName: "The Pickle Romance",
  category: "Homemade Indian pickles",
  product: "Aam ka Achar",
  price: "399",
  productBundle: "700g Aam ka Achar non-oily jar",
  promoHook: "Free next-day delivery in Faridabad",
  offer: "700g Aam ka Achar non-oily jar",
  audience:
    "Working mothers in Faridabad, age 30-40. They like pickles but hesitate because market pickles feel too oily.",
  whoBuys: "Working mothers in Faridabad",
  whereLive: "Faridabad",
  substitute: "Supermarket brands and local home chefs",
  hesitation: "oily",
  hesitationLabel: "oily",
  audienceConfidence: "very_sure",
  currentRevenue: "10000",
  goalAmount: "50000",
  goalDays: "30",
  orderChannel: "WhatsApp with UPI before delivery",
  deliveryArea: "Faridabad",
  reelsPerWeek: "2",
  whatsappBroadcasts: "yes",
  storiesPerWeek: "no",
  onCamera: "yes",
  hoursPerWeek: "3",
  brandTone: "Homemade, nostalgic, playful, trustworthy",
  brandMission:
    "Indian meals have always had a love affair with pickles. We bottle that romance with ghar-ka taste and less oil.",
  brandDifferentiation:
    "Non-oily and zero-oil lines. Mishri not refined sugar. Founder delivers in Faridabad.",
  brandStage: "Early traction — under Rs 1 lakh/month",
  pastFailures: "Discount posts got views but almost no WhatsApp orders.",
  channels: ["Instagram Reels", "WhatsApp campaign"],
};

const generatorForm = document.querySelector("#generatorForm");
const loadSample = document.querySelector("#loadSample");
const sidebarNav = document.querySelector("#sidebarNav");
const commandCenter = document.querySelector("#commandCenter");
const contentBento = document.querySelector("#contentBento");
const trackerForm = document.querySelector("#trackerForm");
const insightCard = document.querySelector("#insightCard");
const campaignHistoryList = document.querySelector("#campaignHistoryList");
const experimentPanel = document.querySelector("#experimentPanel");
const experimentPanelBody = document.querySelector("#experimentPanelBody");
const coachPanel = document.querySelector("#coachPanel");
const discoveryPanel = document.querySelector("#discoveryPanel");
const briefPanel = document.querySelector("#briefPanel");

let currentPlan = null;
let currentCampaignId = null;
let campaignHistory = [];
let activeView = "dashboard";
let currentSetupStep = 1;
let discoveryMode = false;
let discoveryOverride = false;
let pendingCoachDraft = null;
let lastTraceTags = { promo: "", hesitation: "" };

const VAGUE_PATTERN = /\b(everyone|all india|anyone|everybody|anybody)\b/i;

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatRupee(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "";
  return `Rs. ${n.toLocaleString("en-IN")}`;
}

function parseNumber(value) {
  if (value == null) return 0;
  const cleaned = String(value).replace(/,/g, "").match(/[0-9]+(\.[0-9]+)?/);
  return cleaned ? Number(cleaned[0]) : 0;
}

function numberFromCurrency(value) {
  return parseNumber(value);
}

function compactGoal(value) {
  const number = numberFromCurrency(value);
  if (!number) return "--";
  if (number >= 100000) return `₹${Math.round(number / 100000)}L`;
  if (number >= 1000) return `₹${Math.round(number / 1000)}K`;
  return `₹${number.toLocaleString("en-IN")}`;
}

function unitTarget(goal, price) {
  const goalNumber = numberFromCurrency(goal);
  const priceNumber = numberFromCurrency(price);
  if (!goalNumber || !priceNumber) return 0;
  return Math.ceil(goalNumber / priceNumber);
}

function buildRevenueGoalString(goalAmount, goalDays) {
  const amount = parseNumber(goalAmount);
  const days = parseNumber(goalDays) || 30;
  if (!amount) return "";
  return `${formatRupee(amount)} in ${days} days`;
}

function buildContentCapacity(input) {
  const parts = [];
  const reels = input.reelsPerWeek ?? "2";
  parts.push(`${reels} Reels/week`);
  if (input.whatsappBroadcasts === "yes") parts.push("WhatsApp broadcasts");
  if (input.storiesPerWeek === "yes") parts.push("Instagram Stories");
  if (input.onCamera === "no") parts.push("not on camera");
  if (input.hoursPerWeek) parts.push(`~${input.hoursPerWeek} hrs/week`);
  return parts.join(", ");
}

function getAudienceAnswers() {
  const data = new FormData(generatorForm);
  const val = (name, unsureName) => {
    if (data.get(unsureName) === "on") return "not_sure";
    return data.get(name)?.toString().trim() || "";
  };
  return {
    whoBuys: val("whoBuys", "whoBuysUnsure"),
    whereLive: val("whereLive", "whereLiveUnsure"),
    substitute: val("substitute", "substituteUnsure"),
    hesitation: data.get("hesitation")?.toString() || "",
    confidence: data.get("audienceConfidence")?.toString() || "",
  };
}

function needsDiscovery(answers) {
  if (answers.confidence === "not_sure") return true;
  const fields = [answers.whoBuys, answers.whereLive, answers.substitute, answers.hesitation];
  const blanks = fields.filter((v) => !v || v === "not_sure").length;
  if (blanks >= 2) return true;
  if ([answers.whoBuys, answers.whereLive].some((v) => VAGUE_PATTERN.test(v || ""))) return true;
  return false;
}

function computeGoalIntelligence(input) {
  const current = parseNumber(input.currentRevenue);
  const stretch = parseNumber(input.goalAmount);
  const days = parseNumber(input.goalDays) || 30;
  const price = parseNumber(input.price);
  const ordersNeeded = price && stretch ? Math.ceil(stretch / price) : 0;
  const weeks = Math.max(days / 7, 1);
  const ordersPerWeek = Math.ceil(ordersNeeded / weeks);

  let recommended = stretch;
  const stage = input.brandStage || "";

  if (stage.includes("Idea") || stage.includes("First sales") || current < 10000) {
    const floor = Math.max(price * 8, 5000);
    const cap = current > 0 ? Math.max(current * 2.5, floor) : Math.max(floor, 8000);
    recommended = Math.min(cap, stretch || cap);
  } else if (stage.includes("Early traction")) {
    recommended = Math.min(Math.max(current * 1.35, 15000), stretch || current * 1.35);
  } else {
    recommended = Math.min(Math.max(current * 1.25, 20000), stretch || current * 1.25);
  }

  recommended = Math.round(recommended / 500) * 500;
  if (!recommended) recommended = Math.min(stretch, 10000);

  const base = Math.max(current, 1000);
  const ratio = stretch / base;
  const isAggressive = ratio > 4 || (current < 1000 && stretch > 15000);
  const isAbsurd = ratio > 15 || (current < 1000 && stretch >= 50000);

  let explanation = `You need about ${ordersNeeded} orders in ${days} days (~${ordersPerWeek}/week) at ${input.price || "your price"}.`;
  if (isAbsurd) {
    explanation += " That jump is very large for your current sales — start smaller and prove repeat orders first.";
  } else if (isAggressive) {
    explanation += " This is a stretch — we'll phase the plan if you choose it.";
  }

  return {
    recommended,
    stretch,
    ordersNeeded,
    ordersPerWeek,
    isAggressive,
    isAbsurd,
    explanation,
    recommendedGoalString: buildRevenueGoalString(recommended, days),
  };
}

function getFormInput() {
  const data = new FormData(generatorForm);
  const goalAmount = data.get("goalChoice") === "recommended"
    ? String(computeGoalIntelligence({
        currentRevenue: formatRupee(parseNumber(data.get("currentRevenue"))),
        goalAmount: data.get("goalAmount"),
        goalDays: data.get("goalDays"),
        brandStage: data.get("brandStage"),
        price: formatRupee(parseNumber(data.get("price"))),
      }).recommended)
    : data.get("goalAmount")?.toString().trim() || "";

  const goalDays = data.get("goalDays")?.toString().trim() || "30";
  const priceRaw = data.get("price")?.toString().trim() || "";
  const revenueRaw = data.get("currentRevenue")?.toString().trim() || "";
  const productBundle = data.get("productBundle")?.toString().trim() || data.get("offer")?.toString().trim() || "";
  const promoHook = data.get("promoHook")?.toString().trim() || "";
  const goalIntel = computeGoalIntelligence({
    currentRevenue: formatRupee(parseNumber(revenueRaw)),
    goalAmount: data.get("goalAmount"),
    goalDays,
    brandStage: data.get("brandStage")?.toString() || "",
    price: formatRupee(parseNumber(priceRaw)),
  });

  const reelsPerWeek = data.get("reelsPerWeek")?.toString() || "2";
  const whatsappBroadcasts = data.get("whatsappBroadcasts")?.toString() || "yes";
  const storiesPerWeek = data.get("storiesPerWeek")?.toString() || "no";
  const onCamera = data.get("onCamera")?.toString() || "yes";
  const hoursPerWeek = data.get("hoursPerWeek")?.toString() || "3";

  const capacityObj = { reelsPerWeek, whatsappBroadcasts, storiesPerWeek, onCamera, hoursPerWeek };
  const contentCapacity = buildContentCapacity(capacityObj);

  const audience = data.get("audience")?.toString().trim() || "";
  const hesitationLabel = data.get("hesitationLabel")?.toString().trim() || data.get("hesitation")?.toString() || "";

  const goalChoice = data.get("goalChoice")?.toString() || "recommended";

  return {
    brandName: data.get("brandName")?.toString().trim() || "",
    category: data.get("category")?.toString().trim() || "",
    product: data.get("product")?.toString().trim() || "",
    price: formatRupee(parseNumber(priceRaw)),
    productBundle,
    promoHook,
    offer: productBundle,
    audience,
    whoBuys: data.get("whoBuys")?.toString().trim() || "",
    whereLive: data.get("whereLive")?.toString().trim() || "",
    substitute: data.get("substitute")?.toString().trim() || "",
    hesitation: data.get("hesitation")?.toString() || "",
    hesitationLabel,
    audienceConfidence: data.get("audienceConfidence")?.toString() || "",
    currentRevenue: formatRupee(parseNumber(revenueRaw)),
    revenueGoal: buildRevenueGoalString(goalAmount, goalDays),
    goalAmount,
    goalDays,
    goalChoice,
    recommendedGoal: goalIntel.recommendedGoalString,
    usePhasedPlan: goalChoice === "stretch" && goalIntel.isAggressive,
    orderChannel: data.get("orderChannel")?.toString().trim() || "",
    deliveryArea: data.get("deliveryArea")?.toString().trim() || "",
    contentCapacity,
    reelsPerWeek,
    whatsappBroadcasts,
    storiesPerWeek,
    onCamera,
    hoursPerWeek,
    brandTone: data.get("brandTone")?.toString().trim() || "",
    brandMission: data.get("brandMission")?.toString().trim() || "",
    brandDifferentiation: data.get("brandDifferentiation")?.toString().trim() || "",
    brandStage: data.get("brandStage")?.toString().trim() || "",
    pastFailures: data.get("pastFailures")?.toString().trim() || "",
    channels: data.getAll("channels").map((c) => c.toString()),
    discoveryMode: discoveryMode && !discoveryOverride,
    discoveryOverride,
  };
}

function validateStep(step) {
  const data = new FormData(generatorForm);
  const errors = [];
  if (step === 1) {
    if (!data.get("brandName")?.toString().trim()) errors.push("Brand name is required.");
    if (!data.get("product")?.toString().trim()) errors.push("Product is required.");
    if (!parseNumber(data.get("price"))) errors.push("Enter a valid price.");
  }
  if (step === 2) {
    if (!data.get("audienceConfidence")) errors.push("Tell us how sure you are about your customer.");
    const answers = getAudienceAnswers();
    if (needsDiscovery(answers) && !data.get("audience")?.toString().trim() && !discoveryMode) {
      errors.push("We need a short customer summary — try Discovery Week or click Help me write this clearly.");
    }
  }
  if (step === 3) {
    if (!data.get("productBundle")?.toString().trim()) errors.push("Describe what's in the jar/box.");
  }
  if (step === 4) {
    if (!parseNumber(data.get("goalAmount"))) errors.push("Enter a revenue goal.");
    if (!data.get("orderChannel")) errors.push("Select how customers order.");
    if (!data.get("deliveryArea")?.toString().trim()) errors.push("Delivery area is required.");
    if (!data.getAll("channels").length) errors.push("Select at least one channel.");
  }
  if (step === 5) {
    if ((data.get("brandMission")?.toString().trim() || "").length < 20) {
      errors.push("Brand mission: 20+ characters.");
    }
    if (!data.get("brandStage")) errors.push("Select your brand stage.");
  }
  return errors;
}

function showSetupStep(step) {
  currentSetupStep = step;
  generatorForm.querySelectorAll("[data-setup-step]").forEach((el) => {
    el.classList.toggle("hidden", Number(el.dataset.setupStep) !== step);
  });
  document.querySelectorAll("#setupWizardNav .wizard-step").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.step) === step);
  });
  document.querySelector("#wizardPrev").classList.toggle("hidden", step === 1);
  document.querySelector("#wizardNext").classList.toggle("hidden", step === 5);
  document.querySelector("#openBriefBtn").classList.toggle("hidden", step !== 5);
  if (step === 4) renderGoalIntelligence();
  updateDraftState();
}

function renderGoalIntelligence() {
  const input = getFormInput();
  const intel = computeGoalIntelligence(input);
  const summary = document.querySelector("#goalIntelSummary");
  const warn = document.querySelector("#goalWarning");

  summary.textContent = intel.explanation;
  document.querySelector("#recommendedGoalLabel").textContent = `Recommended: ${compactGoal(intel.recommendedGoalString)}`;
  document.querySelector("#recommendedGoalNote").textContent = "Safer target based on your stage and revenue.";
  document.querySelector("#stretchGoalLabel").textContent = `Your target: ${compactGoal(buildRevenueGoalString(intel.stretch, input.goalDays))}`;
  document.querySelector("#stretchGoalNote").textContent = `${intel.ordersNeeded} orders (~${intel.ordersPerWeek}/week).`;

  warn.classList.toggle("hidden", !intel.isAggressive);
  if (intel.isAbsurd) {
    warn.textContent =
      "This goal is a big jump from where you are. We strongly recommend starting with the recommended goal.";
  } else if (intel.isAggressive) {
    warn.textContent = "Stretch goal selected — your plan will split Phase 1 (prove it) and Phase 2 (scale).";
  }

  const capField = generatorForm.elements.namedItem("contentCapacity");
  if (capField) capField.value = input.contentCapacity;
}

function applyInputToForm(input) {
  const map = {
    brandName: input.brandName,
    category: input.category,
    product: input.product,
    productBundle: input.productBundle || input.offer,
    promoHook: input.promoHook || "",
    offer: input.productBundle || input.offer,
    audience: input.audience,
    whoBuys: input.whoBuys,
    whereLive: input.whereLive,
    substitute: input.substitute,
    hesitation: input.hesitation,
    hesitationLabel: input.hesitationLabel,
    audienceConfidence: input.audienceConfidence,
    orderChannel: input.orderChannel,
    deliveryArea: input.deliveryArea,
    reelsPerWeek: input.reelsPerWeek || "2",
    whatsappBroadcasts: input.whatsappBroadcasts || "yes",
    storiesPerWeek: input.storiesPerWeek || "no",
    onCamera: input.onCamera || "yes",
    hoursPerWeek: input.hoursPerWeek || "3",
    brandTone: input.brandTone,
    brandMission: input.brandMission,
    brandDifferentiation: input.brandDifferentiation,
    brandStage: input.brandStage,
    pastFailures: input.pastFailures || "",
    goalDays: input.goalDays || "30",
  };

  for (const [key, value] of Object.entries(map)) {
    const field = generatorForm.elements.namedItem(key);
    if (field && value != null) field.value = value;
  }

  const priceField = generatorForm.elements.namedItem("price");
  if (priceField) priceField.value = String(parseNumber(input.price) || "");

  const revenueField = generatorForm.elements.namedItem("currentRevenue");
  if (revenueField) revenueField.value = String(parseNumber(input.currentRevenue) || "");

  const goalField = generatorForm.elements.namedItem("goalAmount");
  if (goalField) goalField.value = String(parseNumber(input.goalAmount) || parseNumber(input.revenueGoal) || "");

  const channels = input.channels || [];
  generatorForm.querySelectorAll('input[name="channels"]').forEach((checkbox) => {
    checkbox.checked = channels.includes(checkbox.value);
  });

  discoveryMode = Boolean(input.discoveryMode);
  discoveryOverride = Boolean(input.discoveryOverride);
}

function getTrackerData() {
  const data = new FormData(trackerForm);
  const objectionSelect = data.get("closeObjection")?.toString() || "";
  const topField = trackerForm.elements.namedItem("topObjection");
  if (topField && objectionSelect) topField.value = objectionSelect;

  return {
    views: Number(data.get("views")) || 0,
    saves: Number(data.get("saves")) || 0,
    shares: Number(data.get("shares")) || 0,
    inquiries: Number(data.get("inquiries")) || 0,
    whatsappClicks: Number(data.get("whatsappClicks")) || 0,
    orders: Number(data.get("orders")) || 0,
    revenue: Number(data.get("revenue")) || 0,
  };
}

function getCloseLearnings() {
  const data = new FormData(trackerForm);
  return {
    bestHook: data.get("bestHook")?.toString().trim() || "",
    topObjection: data.get("closeObjection")?.toString() || data.get("topObjection")?.toString().trim() || "",
    repeat: data.get("repeatNext")?.toString().trim() || "",
    stop: data.get("stopDoing")?.toString().trim() || "",
  };
}

async function callCoach(action, payload) {
  const response = await fetch("/api/coach", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Coach request failed");
  return data.result;
}

async function runAudienceCoach() {
  const input = getFormInput();
  const answers = getAudienceAnswers();
  const status = document.querySelector("#audienceCoachStatus");
  status.textContent = "Writing a clear version…";

  try {
    if (needsDiscovery(answers)) {
      await openDiscoveryWeek();
      status.textContent = "Discovery Week opened — do the checklist first.";
      return;
    }

    const result = await callCoach("audience_draft", { input, answers });
    pendingCoachDraft = result;
    document.querySelector("#coachFounderText").textContent = result.founderSummary || "";
    document.querySelector("#coachClearText").textContent = result.clearVersion || "";
    coachPanel.classList.remove("hidden");
    status.textContent = "Review the clear version below.";
  } catch (error) {
    status.textContent = error.message;
  }
}

async function openDiscoveryWeek() {
  const input = getFormInput();
  discoveryMode = true;
  localStorage.setItem(`sa_discovery_${input.brandName}`, JSON.stringify({ discoveryMode: true }));
  document.querySelector("#discoveryStatus").textContent = "Building your 1-week checklist…";

  try {
    const result = await callCoach("discovery_week", { input });
    document.querySelector("#discoveryIntro").textContent = result.intro || "";
    document.querySelector("#discoveryTasks").innerHTML = (result.tasks || [])
      .map(
        (t) => `
        <article class="discovery-task">
          <strong>${escapeHtml(t.day)}: ${escapeHtml(t.title)}</strong>
          <p>${escapeHtml(t.action)}</p>
          <pre class="script-block">${escapeHtml(t.script || "")}</pre>
          <span class="label muted">Note: ${escapeHtml(t.noteWhatToWrite || "")}</span>
        </article>
      `,
      )
      .join("");
    document.querySelector("#discoveryWhatsapp").textContent = result.interimWhatsapp || "";
    document.querySelector("#discoveryReel").textContent = result.interimReelIdea || "";
    discoveryPanel.classList.remove("hidden");
    document.querySelector("#discoveryStatus").textContent = "";
  } catch (error) {
    document.querySelector("#discoveryStatus").textContent = error.message;
  }
}

async function synthesizeDiscovery() {
  const input = getFormInput();
  const findings = {
    whoFound: document.querySelector("#whoFound").value,
    areasFound: document.querySelector("#areasFound").value,
    substituteFound: document.querySelector("#substituteFound").value,
    hesitationFound: document.querySelector("#hesitationFound").value,
  };
  const status = document.querySelector("#discoveryStatus");
  status.textContent = "Turning your notes into a customer summary…";

  try {
    const result = await callCoach("discovery_synthesize", { input, findings });
    generatorForm.elements.namedItem("audience").value = result.audience || "";
    generatorForm.elements.namedItem("hesitationLabel").value = result.hesitationLabel || "";
    discoveryMode = false;
    discoveryOverride = false;
    localStorage.removeItem(`sa_discovery_${input.brandName}`);
    discoveryPanel.classList.add("hidden");
    status.textContent = result.confidenceNote || "Customer summary saved.";
    document.querySelector("#audienceCoachStatus").textContent =
      "Nice — you talked to real people. That's real data.";
    showSetupStep(3);
  } catch (error) {
    status.textContent = error.message;
  }
}

async function structureFailures() {
  const input = getFormInput();
  const data = new FormData(generatorForm);
  const checklist = {
    channel: data.get("failChannel")?.toString() || "",
    contentType: data.get("failOutcome")?.toString() || "",
    outcome: data.get("failOutcome")?.toString() || "",
    stopDoing: data.get("failStop")?.toString() || "",
  };
  if (!checklist.channel && !checklist.outcome) return;

  try {
    const result = await callCoach("failure_debrief", { input, checklist });
    generatorForm.elements.namedItem("pastFailures").value = result.pastFailures || "";
  } catch {
    generatorForm.elements.namedItem("pastFailures").value = [
      checklist.channel && `Tried ${checklist.channel}`,
      checklist.outcome && `Result: ${checklist.outcome}`,
      checklist.stopDoing && `Stop: ${checklist.stopDoing}`,
    ]
      .filter(Boolean)
      .join(". ");
  }
}

function renderBriefReview() {
  const input = getFormInput();
  const intel = computeGoalIntelligence(input);
  document.querySelector("#briefReview").innerHTML = `
    <div class="brief-review-block"><span class="label">Customer</span><p>${escapeHtml(input.audience || "—")}</p></div>
    <div class="brief-review-block"><span class="label">Product</span><p>${escapeHtml(input.productBundle)}</p></div>
    <div class="brief-review-block"><span class="label">Promo hook</span><p>${escapeHtml(input.promoHook || "None")}</p></div>
    <div class="brief-review-block"><span class="label">Goal</span><p>${escapeHtml(input.revenueGoal)} ${input.goalChoice === "stretch" && intel.isAggressive ? "(phased plan)" : ""}</p></div>
    <div class="brief-review-block"><span class="label">Capacity</span><p>${escapeHtml(input.contentCapacity)}</p></div>
    <div class="brief-review-block"><span class="label">Channels</span><p>${escapeHtml(input.channels.join(", "))}</p></div>
  `;
}

function renderSparkBars(containerId, values, variant = "") {
  const container = document.querySelector(containerId);
  if (!container) return;
  container.className = `spark-bars${variant ? ` ${variant}` : ""}`;
  container.innerHTML = values.map((height) => `<span style="height:${height}%"></span>`).join("");
}

function setRingProgress(percent) {
  const ring = document.querySelector("#dashboardRing");
  if (!ring) return;
  const circumference = 552.92;
  const offset = circumference - (Math.min(100, percent) / 100) * circumference;
  ring.style.strokeDashoffset = offset;
}

function switchView(view) {
  activeView = view;
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("active", section.dataset.view === view);
  });
  document.querySelectorAll(".nav-link[data-view]").forEach((link) => {
    link.classList.toggle("active", link.dataset.view === view);
  });
  if (view === "campaign") void loadCampaignHistory();
}

function statusBadge(status) {
  const normalized = (status || "live").toLowerCase();
  const cls =
    normalized === "closed"
      ? "status-closed"
      : normalized === "paused"
        ? "status-paused"
        : normalized === "draft"
          ? "status-draft"
          : "status-live";
  return `<span class="history-status ${cls}">${escapeHtml(normalized)}</span>`;
}

function formatHistoryDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

async function loadCampaignHistory() {
  if (!campaignHistoryList) return;
  campaignHistoryList.innerHTML = `<p class="muted">Loading past campaigns…</p>`;

  try {
    const response = await fetch("/api/campaigns");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to load history");

    campaignHistory = data.campaigns || [];
    if (!data.configured) {
      campaignHistoryList.innerHTML = `<p class="muted">History unavailable — configure Supabase on Vercel.</p>`;
      return;
    }

    if (!campaignHistory.length) {
      campaignHistoryList.innerHTML = `<p class="muted">No saved campaigns yet. Generate your first plan to start history.</p>`;
      updateCampaignHeader();
      return;
    }

    campaignHistoryList.innerHTML = campaignHistory
      .map(
        (row) => `
          <article class="history-row ${row.id === currentCampaignId ? "active-row" : ""}">
            <div class="history-row-main">
              <strong>${escapeHtml(row.product)}</strong>
              <span class="muted">${escapeHtml(row.brand_name)} · ${formatHistoryDate(row.created_at)}</span>
              <span class="muted">${escapeHtml(row.goal || "")}</span>
            </div>
            <div class="history-row-actions">
              ${statusBadge(row.status)}
              <button class="btn-ghost small" type="button" data-load-campaign="${escapeHtml(row.id)}">Load</button>
              <button class="btn-ghost small" type="button" data-run-again="${escapeHtml(row.id)}">Run again</button>
              ${row.status === "live" ? `<button class="btn-ghost small" type="button" data-stop-campaign="${escapeHtml(row.id)}">Stop</button>` : ""}
              <button class="btn-ghost small danger" type="button" data-delete-campaign="${escapeHtml(row.id)}">Delete</button>
            </div>
          </article>
        `,
      )
      .join("");

    updateCampaignHeader();
  } catch (error) {
    campaignHistoryList.innerHTML = `<p class="muted">Could not load history: ${escapeHtml(error.message)}</p>`;
  }
}

function updateCampaignHeader() {
  const input = getFormInput();
  const active = campaignHistory.find((c) => c.id === currentCampaignId);
  const liveForBrand = campaignHistory.find(
    (c) => c.brand_name === input.brandName && c.status === "live",
  );

  if (currentPlan && currentCampaignId) {
    document.querySelector("#campaignProductName").textContent = `${input.product || active?.product} campaign`;
    document.querySelector("#campaignSummary").textContent =
      currentPlan.summary?.positioning || `Active campaign for ${input.brandName}.`;
  } else if (liveForBrand) {
    document.querySelector("#campaignProductName").textContent = `${liveForBrand.product} (load from history)`;
    document.querySelector("#campaignSummary").textContent = "Click Load on your live campaign to continue.";
  } else if (!currentPlan) {
    document.querySelector("#campaignProductName").textContent = "No active campaign";
    document.querySelector("#campaignSummary").textContent =
      "Complete Brand Setup and build your brief to unlock the command center.";
  }
}

function parsePlanFromRow(row) {
  if (!row?.plan_text) return null;
  try {
    return JSON.parse(row.plan_text);
  } catch {
    return null;
  }
}

function loadCampaignFromHistory(id, { duplicate = false } = {}) {
  const row = campaignHistory.find((item) => item.id === id);
  if (!row) return;

  const input = row.input_payload || {};
  applyInputToForm(input);

  if (duplicate) {
    currentPlan = null;
    currentCampaignId = null;
    renderEmptyPlan();
    updateDraftState();
    showSetupStep(1);
    switchView("setup");
    return;
  }

  const plan = parsePlanFromRow(row);
  if (!plan) {
    alert("This campaign has no readable plan data.");
    return;
  }

  currentCampaignId = row.id;
  renderPlan(plan, { ...getFormInput(), ...input });

  const metrics = row.metrics?.tracker;
  if (metrics) {
    for (const [key, value] of Object.entries(metrics)) {
      const field = trackerForm.elements.namedItem(key);
      if (field) field.value = value;
    }
  }

  const learnings = row.metrics?.learnings;
  if (learnings) {
    const objectionField = trackerForm.elements.namedItem("closeObjection");
    if (objectionField && learnings.topObjection) objectionField.value = learnings.topObjection;
    const map = { bestHook: learnings.bestHook, repeatNext: learnings.repeat, stopDoing: learnings.stop };
    for (const [key, value] of Object.entries(map)) {
      const field = trackerForm.elements.namedItem(key);
      if (field && value) field.value = value;
    }
  }

  switchView("campaign");
  updateDraftState();
}

async function stopCampaign(id) {
  const response = await fetch("/api/campaigns", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, status: "paused" }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to stop campaign");
  if (currentCampaignId === id) currentCampaignId = null;
  await loadCampaignHistory();
}

async function deleteCampaign(id) {
  if (!confirm("Delete this campaign from history?")) return;
  const response = await fetch(`/api/campaigns?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to delete");
  if (currentCampaignId === id) {
    currentCampaignId = null;
    currentPlan = null;
    renderEmptyPlan();
  }
  await loadCampaignHistory();
  updateDraftState();
}

function updateDraftState() {
  const input = getFormInput();
  const tracker = getTrackerData();
  const goal = numberFromCurrency(input.revenueGoal);
  const units = unitTarget(input.revenueGoal, input.price);
  const progress = goal ? Math.min(100, Math.round((tracker.revenue / goal) * 100)) : 0;
  const intel = computeGoalIntelligence(input);
  const primaryChannel = input.channels.includes("WhatsApp campaign")
    ? "WhatsApp"
    : input.channels[0]?.replace(" campaign", "") || "--";
  const isClosed = campaignHistory.find((c) => c.id === currentCampaignId)?.status === "closed";

  document.querySelector("#topBrandName").textContent = input.brandName || "No brand selected";
  document.querySelector("#topGoalChip").textContent = input.revenueGoal
    ? `Current Goal: ${compactGoal(input.revenueGoal)}`
    : "Current Goal: --";
  document.querySelector("#sideGoalValue").textContent = compactGoal(input.revenueGoal);

  const tipParts = [];
  if (intel.isAbsurd) tipParts.push(`₹${parseNumber(input.goalAmount).toLocaleString("en-IN")} is a big jump — recommended ${compactGoal(intel.recommendedGoalString)}.`);
  else if (intel.ordersPerWeek) tipParts.push(`Need ~${intel.ordersPerWeek} orders/week.`);
  if (input.promoHook) tipParts.push(`Promo: ${input.promoHook.slice(0, 40)}…`);
  document.querySelector("#sideGoalTip").textContent = tipParts.length
    ? tipParts.join(" ")
    : "Complete setup to see goal math.";

  document.querySelector("#briefTitle").textContent = input.product ? `${input.product} growth brief` : "Waiting for inputs";
  document.querySelector("#briefCopy").textContent = input.audience
    ? `Customer: ${input.audience.slice(0, 120)}${input.audience.length > 120 ? "…" : ""}`
    : "Step through the wizard — we help you think before we plan.";

  document.querySelector("#briefStack").innerHTML = [
    ["Goal", input.revenueGoal],
    ["Promo", input.promoHook || "—"],
    ["Hesitation", input.hesitationLabel || "—"],
    ["Capacity", input.contentCapacity],
    ["Stage", input.brandStage],
  ]
    .filter(([, value]) => value && value !== "—")
    .map(
      ([label, value]) => `
        <div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
      `,
    )
    .join("");

  document.querySelector("#dashboardGoalLabel").textContent = units ? `Goal: ${units} units` : "Goal: add setup";
  document.querySelector("#dashboardRevenueLabel").textContent = `Target revenue: ${compactGoal(input.revenueGoal)}`;
  document.querySelector("#dashboardUnits").textContent = String(units || 0);
  setRingProgress(progress);

  document.querySelector("#metricViews").textContent = tracker.views.toLocaleString("en-IN");
  document.querySelector("#metricInquiries").textContent = tracker.inquiries.toLocaleString("en-IN");
  document.querySelector("#metricOrders").textContent = tracker.orders.toLocaleString("en-IN");

  document.querySelector("#dashboardProductName").textContent = currentPlan
    ? `${input.product} campaign`
    : input.product || "No active campaign";
  document.querySelector("#dashboardPositioning").textContent =
    currentPlan?.summary?.positioning ||
    (input.product ? `Configure and generate a 30-day plan for ${input.product}.` : "Configure brand setup and generate a plan.");
  document.querySelector("#dashboardLiveBadge").textContent = isClosed ? "Closed" : currentPlan ? "Active Campaign" : "Draft";
  document.querySelector("#dashboardStatusPill").textContent = isClosed ? "CLOSED" : currentPlan ? "LIVE" : "SETUP";
  document.querySelector("#dashStatGoal").textContent = compactGoal(input.revenueGoal);
  document.querySelector("#dashStatChannel").textContent = primaryChannel;
  document.querySelector("#dashStatRevenue").textContent = `₹${tracker.revenue.toLocaleString("en-IN")}`;
  document.querySelector("#dashStatProgress").textContent = `${progress}%`;

  document.querySelector("#sideGoalBar").style.width = `${currentPlan ? Math.max(8, progress) : 0}%`;

  if (!currentPlan) updateCampaignHeader();
  updateInsights();
}

function fillSample() {
  applyInputToForm(sampleBrand);
  generatorForm.querySelectorAll('input[name="channels"]').forEach((checkbox) => {
    checkbox.checked = sampleBrand.channels.includes(checkbox.value);
  });
  generatorForm.elements.namedItem("audience").value = sampleBrand.audience;
  generatorForm.elements.namedItem("hesitationLabel").value = sampleBrand.hesitationLabel;
  currentPlan = null;
  currentCampaignId = null;
  discoveryMode = false;
  renderEmptyPlan();
  showSetupStep(1);
  updateDraftState();
  switchView("setup");
}

function normalizePlan(payload) {
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return { summary: {}, diagnosis: [], weeklyPlan: [], contentAssets: {}, metrics: [], nextActions: [] };
    }
  }
  return payload || {};
}

function renderEmptyPlan() {
  commandCenter.className = "glass-card command-empty";
  commandCenter.innerHTML = `
    <span class="material-symbols-outlined empty-icon">campaign</span>
    <h3>No plan generated yet</h3>
    <p>Complete Brand Setup → Review brief → Build your 30-day roadmap.</p>
    <button class="btn-primary" data-view="setup" type="button">Go to Brand Setup</button>
  `;
  contentBento.innerHTML = `
    <div class="glass-card empty-studio">
      <span class="material-symbols-outlined empty-icon">movie_edit</span>
      <h3>No assets yet</h3>
      <p>Reels, WhatsApp, website, and LinkedIn copy appear here after plan generation.</p>
    </div>
  `;
}

function assetTags(input) {
  const tags = [];
  if (input.promoHook) tags.push(`Uses offer: ${input.promoHook}`);
  if (input.hesitationLabel) tags.push(`Targets: ${input.hesitationLabel} hesitation`);
  lastTraceTags = { promo: input.promoHook, hesitation: input.hesitationLabel };
  return tags.map((t) => `<span class="asset-tag">${escapeHtml(t)}</span>`).join("");
}

function renderPlan(plan, input) {
  currentPlan = normalizePlan(plan);
  const summary = currentPlan.summary || {};

  document.querySelector("#campaignProductName").textContent = `${input.product} campaign`;
  document.querySelector("#campaignSummary").textContent =
    summary.positioning || `A 30-day plan to grow ${input.product} through ${input.channels.join(", ")}.`;
  document.querySelector("#campaignProjection").textContent = input.usePhasedPlan
    ? "AI Projection: phased plan (prove → scale)"
    : "AI Projection: on track";
  document.querySelector("#contentStudioTitle").textContent = `${input.product} Campaign`;
  document.querySelector("#contentAiBadge").textContent = "AI Content Generation Active";
  document.querySelector("#contentUpdated").textContent = "Just generated";

  const insight = summary.coreInsight || currentPlan.nextActions?.[0];
  if (insight) {
    document.querySelector("#insightTitle").textContent = "Execute your top growth move";
    document.querySelector("#insightBody").textContent = insight;
  }

  renderCommandCenter(currentPlan, input);
  renderContentStudio(currentPlan.contentAssets || {}, input);
  updateDraftState();
  void loadCampaignHistory();
}

function renderExperimentDetail(exp) {
  return `
    <article class="experiment-detail">
      <div class="experiment-detail-head">
        <span class="label">${escapeHtml(exp.type || "Experiment")}</span>
        <strong>${escapeHtml(exp.title || "Untitled")}</strong>
      </div>
      <dl>
        <div><dt>Why</dt><dd>${escapeHtml(exp.why || "—")}</dd></div>
        <div><dt>Action</dt><dd>${escapeHtml(exp.action || "—")}</dd></div>
        <div><dt>CTA</dt><dd>${escapeHtml(exp.cta || "—")}</dd></div>
        <div><dt>Metric</dt><dd>${escapeHtml(exp.metric || "—")}</dd></div>
        <div><dt>Decision rule</dt><dd>${escapeHtml(exp.decisionRule || "—")}</dd></div>
      </dl>
    </article>
  `;
}

function openExperimentPanel(weekIndex) {
  const weeks = currentPlan?.weeklyPlan || [];
  const week = weeks[weekIndex];
  if (!week) return;
  document.querySelector("#experimentPanelWeek").textContent = week.week || `Week ${weekIndex + 1}`;
  document.querySelector("#experimentPanelTheme").textContent = week.theme || "Experiments";
  experimentPanelBody.innerHTML = (week.experiments || []).map((exp) => renderExperimentDetail(exp)).join("");
  experimentPanel.classList.remove("hidden");
}

function closeExperimentPanel() {
  experimentPanel.classList.add("hidden");
}

function renderCommandCenter(plan, input) {
  const summary = plan.summary || {};
  const diagnosis = plan.diagnosis || [];
  const weeks = plan.weeklyPlan || [];
  const nextActions = plan.nextActions || [];

  commandCenter.className = "campaign-console";
  commandCenter.innerHTML = `
    <div class="glass-card timeline-card">
      <div class="timeline-header">
        <h4>Strategic Milestones</h4>
        ${input.usePhasedPlan ? '<span class="phase-chip build">Phased: prove then scale</span>' : ""}
      </div>
    </div>
    <h4 class="section-label">Weekly Execution Modules</h4>
    <div class="week-grid">${weeks.map((week, index) => renderWeekModule(week, index)).join("")}</div>
    <section class="plan-brief">
      <article><span>Positioning</span><strong>${escapeHtml(summary.positioning || "")}</strong></article>
      <article><span>Target</span><strong>${escapeHtml(summary.primaryGoal || input.revenueGoal)}</strong></article>
      <article><span>Unit math</span><strong>${escapeHtml(summary.unitTarget || `${unitTarget(input.revenueGoal, input.price)} units`)}</strong></article>
      <article><span>Risk</span><strong>${escapeHtml(summary.risk || "")}</strong></article>
    </section>
    <section class="diagnosis-grid">
      ${diagnosis
        .slice(0, 3)
        .map(
          (item) => `
            <article><span>${escapeHtml(item.label || "")}</span><p>${escapeHtml(item.detail || "")}</p></article>
          `,
        )
        .join("")}
    </section>
    <section class="next-actions-block glass-card">
      <div><span class="label text-primary">Next 7 days</span><h3>Do these first</h3></div>
      <ol>${nextActions.map((action) => `<li>${escapeHtml(action)}</li>`).join("")}</ol>
    </section>
  `;
}

function renderWeekModule(week, index) {
  const experiments = week.experiments || [];
  const tasks = experiments.slice(0, 2).map((exp) => exp.title || exp.action || "Experiment");
  return `
    <article class="glass-card week-module">
      <span class="week-badge">${escapeHtml(week.week || `Week ${index + 1}`)}</span>
      <h5>${escapeHtml(week.theme || "Growth sprint")}</h5>
      <ul class="week-tasks">${tasks.map((task) => `<li>${escapeHtml(task)}</li>`).join("")}</ul>
      <button class="week-action" type="button" data-week-index="${index}">View experiments</button>
    </article>
  `;
}

function renderContentStudio(contentAssets, input) {
  const tags = assetTags(input);
  const reels = contentAssets.reels || [];
  const whatsapp = contentAssets.whatsapp || [];

  if (!reels.length && !whatsapp.length) {
    contentBento.innerHTML = `<div class="glass-card empty-studio"><h3>No assets returned</h3></div>`;
    return;
  }

  contentBento.innerHTML = `
    ${tags ? `<div class="asset-tags-row">${tags}</div>` : ""}
    ${reels.length ? renderReelsCard(reels, tags) : ""}
    ${whatsapp.length ? renderWhatsappCard(whatsapp, tags) : ""}
    ${(contentAssets.website || []).length ? renderWebsiteCard(contentAssets.website, input) : ""}
    ${(contentAssets.linkedin || []).length ? renderLinkedinCard(contentAssets.linkedin) : ""}
  `;
}

function renderReelsCard(reels, tags) {
  return `
    <div class="glass-card content-card reels">
      <div class="content-card-header"><h4>Reel Hooks</h4></div>
      ${tags ? `<div class="asset-tags-inline">${tags}</div>` : ""}
      ${reels
        .slice(0, 2)
        .map(
          (asset) => `
            <div class="hook-item">
              <p>"${escapeHtml(asset.hook || asset.script || "")}"</p>
              <span class="label muted">CTA: ${escapeHtml(asset.cta || "")}</span>
              <button class="copy-icon-btn" data-copy-text="${escapeHtml(asset.hook || asset.script || "")}" type="button">
                <span class="material-symbols-outlined">content_copy</span>
              </button>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderWhatsappCard(messages, tags) {
  const first = messages[0] || {};
  const text = first.message || "";
  return `
    <div class="glass-card content-card whatsapp">
      <div class="content-card-header"><h4>WhatsApp Broadcast</h4></div>
      ${tags ? `<div class="asset-tags-inline">${tags}</div>` : ""}
      <p class="message-block">"${escapeHtml(text)}"</p>
      <button class="copy-btn" data-copy-text="${escapeHtml(text)}" type="button">Copy Text</button>
    </div>
  `;
}

function renderWebsiteCard(pages, input) {
  const first = pages[0] || {};
  return `
    <div class="glass-card content-card website">
      <h4>Website</h4>
      <p>${escapeHtml(first.copy || first.title || "")}</p>
    </div>
  `;
}

function renderLinkedinCard(posts) {
  const body = posts[0]?.post || "";
  return `
    <div class="glass-card content-card linkedin">
      <h4>LinkedIn</h4>
      <p>${escapeHtml(body)}</p>
      <button class="copy-btn" data-copy-text="${escapeHtml(body)}" type="button">Copy Post</button>
    </div>
  `;
}

async function generatePlan() {
  const input = getFormInput();

  if (input.discoveryMode) {
    alert("Finish Discovery Week first, or use Build plan anyway.");
    return;
  }

  updateDraftState();
  switchView("campaign");
  briefPanel.classList.add("hidden");
  commandCenter.className = "glass-card command-empty loading-state";
  commandCenter.innerHTML = `
    <span class="material-symbols-outlined empty-icon">sync</span>
    <h3>Building your growth system...</h3>
    <p>Creating weekly sprints and content for ${escapeHtml(input.product)}.</p>
  `;

  try {
    const response = await fetch("/api/generate-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to generate plan");

    if (data.saveResult?.campaign?.id) currentCampaignId = data.saveResult.campaign.id;

    renderPlan(data.plan, input);
    if (data.usedPriorLearnings) {
      document.querySelector("#campaignProjection").textContent = "AI Projection: informed by last closed campaign";
    }
    switchView("campaign");
  } catch (error) {
    commandCenter.className = "glass-card command-empty error-state";
    commandCenter.innerHTML = `<h3>Generation failed</h3><p>${escapeHtml(error.message)}</p>`;
  }
}

async function closeCampaign() {
  const statusEl = document.querySelector("#closeCampaignStatus");
  if (!currentCampaignId) {
    statusEl.textContent = "Generate or load a campaign first.";
    return;
  }
  const tracker = getTrackerData();
  const learnings = getCloseLearnings();
  statusEl.textContent = "Saving learnings…";
  try {
    const response = await fetch("/api/campaigns", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: currentCampaignId, tracker, learnings }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to close campaign");
    statusEl.textContent = "Campaign closed. Next plan will use these learnings.";
    await loadCampaignHistory();
    updateDraftState();
  } catch (error) {
    statusEl.textContent = error.message;
  }
}

function renderChartBars() {
  const tracker = getTrackerData();
  const input = getFormInput();
  const goal = numberFromCurrency(input.revenueGoal);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  document.querySelector("#chartBars").innerHTML = days
    .map(
      (day, index) => `
        <div class="chart-day">
          <div class="bars">
            <span class="goal" style="height:70%"></span>
            <span class="current" style="height:${[55, 65, 45, 80, 95, 30, 10][index]}%"></span>
          </div>
          <span class="label muted">${day}</span>
        </div>
      `,
    )
    .join("");
  const gap = Math.max(0, goal - tracker.revenue);
  document.querySelector("#revenueGap").textContent = gap ? `₹${gap.toLocaleString("en-IN")} left` : "Goal reached";
}

function updateInsights() {
  const tracker = getTrackerData();
  const input = getFormInput();
  const goal = numberFromCurrency(input.revenueGoal);
  const intel = computeGoalIntelligence(input);
  const targetProgress = goal ? Math.min(100, Math.round((tracker.revenue / goal) * 100)) : 0;

  const repeat = currentPlan?.nextActions?.[0] || (input.promoHook ? `Lead with: ${input.promoHook}` : "Test one Reel hook per week.");
  const change = intel.isAggressive
    ? `Phase 1: hit ${compactGoal(intel.recommendedGoalString)} before scaling.`
    : currentPlan?.summary?.risk || "Track WhatsApp replies, not just views.";

  insightCard.innerHTML = `
    <div class="ai-strategy-header">
      <h4><span class="material-symbols-outlined">auto_awesome</span> AI Strategy</h4>
    </div>
    <div class="ai-strategy-body">
      <div class="strategy-item"><div><span class="label muted">Repeat</span><p>${escapeHtml(repeat)}</p></div></div>
      <div class="strategy-item"><div><span class="label muted">Focus</span><p>${escapeHtml(change)}</p></div></div>
      <p class="muted">${targetProgress}% of goal • ~${intel.ordersPerWeek} orders/week needed</p>
    </div>
  `;

  const learnings = getCloseLearnings();
  if (learnings.topObjection) {
    document.querySelector("#objectionQuote").textContent = `"${learnings.topObjection}"`;
  }
  renderChartBars();
}

async function handleWizardNext() {
  const errors = validateStep(currentSetupStep);
  if (errors.length) {
    alert(errors.join("\n"));
    return;
  }

  if (currentSetupStep === 2) {
    const answers = getAudienceAnswers();
    if (needsDiscovery(answers) && !generatorForm.elements.namedItem("audience").value) {
      await openDiscoveryWeek();
      return;
    }
    if (!generatorForm.elements.namedItem("audience").value) {
      await runAudienceCoach();
      if (!generatorForm.elements.namedItem("audience").value) return;
    }
  }

  if (currentSetupStep < 5) showSetupStep(currentSetupStep + 1);
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    experimentPanel.classList.add("hidden");
    coachPanel.classList.add("hidden");
    discoveryPanel.classList.add("hidden");
    briefPanel.classList.add("hidden");
  }
});

document.addEventListener("click", async (event) => {
  const viewTrigger = event.target.closest("[data-view]");
  if (viewTrigger?.dataset.view) switchView(viewTrigger.dataset.view);

  if (event.target.closest("[data-week-index]")) {
    openExperimentPanel(Number(event.target.closest("[data-week-index]").dataset.weekIndex));
    return;
  }
  if (event.target.closest("[data-close-experiments]")) return closeExperimentPanel();
  if (event.target.closest("[data-close-coach]")) return coachPanel.classList.add("hidden");
  if (event.target.closest("[data-close-discovery]")) return discoveryPanel.classList.add("hidden");
  if (event.target.closest("[data-close-brief]")) return briefPanel.classList.add("hidden");

  const loadBtn = event.target.closest("[data-load-campaign]");
  if (loadBtn) return loadCampaignFromHistory(loadBtn.dataset.loadCampaign);

  const runBtn = event.target.closest("[data-run-again]");
  if (runBtn) return loadCampaignFromHistory(runBtn.dataset.runAgain, { duplicate: true });

  const stopBtn = event.target.closest("[data-stop-campaign]");
  if (stopBtn) {
    try {
      await stopCampaign(stopBtn.dataset.stopCampaign);
    } catch (e) {
      alert(e.message);
    }
    return;
  }

  const delBtn = event.target.closest("[data-delete-campaign]");
  if (delBtn) {
    try {
      await deleteCampaign(delBtn.dataset.deleteCampaign);
    } catch (e) {
      alert(e.message);
    }
    return;
  }

  const copy = event.target.closest("[data-copy-text]");
  if (copy) {
    await navigator.clipboard.writeText(copy.dataset.copyText || "");
  }
});

document.querySelector("#wizardNext")?.addEventListener("click", () => void handleWizardNext());
document.querySelector("#wizardPrev")?.addEventListener("click", () => {
  if (currentSetupStep > 1) showSetupStep(currentSetupStep - 1);
});
document.querySelectorAll("#setupWizardNav .wizard-step").forEach((btn) => {
  btn.addEventListener("click", () => {
    const step = Number(btn.dataset.step);
    if (step <= currentSetupStep) showSetupStep(step);
  });
});

document.querySelector("#coachAudienceBtn")?.addEventListener("click", () => void runAudienceCoach());
document.querySelector("#useClearAudience")?.addEventListener("click", () => {
  if (pendingCoachDraft) {
    generatorForm.elements.namedItem("audience").value = pendingCoachDraft.clearVersion || "";
    generatorForm.elements.namedItem("hesitationLabel").value = pendingCoachDraft.hesitationLabel || "";
  }
  coachPanel.classList.add("hidden");
  document.querySelector("#audienceCoachStatus").textContent = "Saved clear version.";
});
document.querySelector("#useFounderAudience")?.addEventListener("click", () => {
  if (pendingCoachDraft) {
    generatorForm.elements.namedItem("audience").value = pendingCoachDraft.founderSummary || "";
  }
  coachPanel.classList.add("hidden");
});

document.querySelector("#showDiscoveryReturn")?.addEventListener("click", () => {
  document.querySelector("#discoveryReturn").classList.remove("hidden");
});
document.querySelector("#synthesizeDiscoveryBtn")?.addEventListener("click", () => void synthesizeDiscovery());
document.querySelector("#forcePlanBtn")?.addEventListener("click", () => {
  discoveryOverride = true;
  discoveryMode = false;
  discoveryPanel.classList.add("hidden");
  alert("OK — we'll build a plan, but it may be less accurate without customer data.");
});

document.querySelector("#structureFailuresBtn")?.addEventListener("click", () => void structureFailures());
document.querySelector("#openBriefBtn")?.addEventListener("click", async () => {
  const errors = validateStep(5);
  if (errors.length) {
    alert(errors.join("\n"));
    return;
  }
  await structureFailures();
  renderBriefReview();
  briefPanel.classList.remove("hidden");
});
document.querySelector("#confirmGenerateBtn")?.addEventListener("click", () => void generatePlan());

document.querySelector("#optimizeBtn")?.addEventListener("click", () => {
  switchView(currentPlan ? "tracker" : "setup");
});
document.querySelector("#syncMetrics")?.addEventListener("click", updateDraftState);
document.querySelector("#closeCampaignBtn")?.addEventListener("click", () => void closeCampaign());
document.querySelector("#refreshHistory")?.addEventListener("click", () => void loadCampaignHistory());

sidebarNav?.addEventListener("click", (event) => {
  const link = event.target.closest(".nav-link[data-view]");
  if (link) switchView(link.dataset.view);
});

loadSample.addEventListener("click", fillSample);
generatorForm.addEventListener("input", () => {
  if (!currentCampaignId) {
    currentPlan = null;
    renderEmptyPlan();
  }
  if (currentSetupStep === 4) renderGoalIntelligence();
  updateDraftState();
});
generatorForm.addEventListener("submit", (e) => e.preventDefault());
trackerForm.addEventListener("input", () => {
  updateDraftState();
  updateInsights();
});

renderEmptyPlan();
showSetupStep(1);
updateDraftState();
setRingProgress(0);
void loadCampaignHistory();
