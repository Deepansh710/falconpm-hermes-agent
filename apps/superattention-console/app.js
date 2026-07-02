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
  campaignScope: "single_sku",
  goalAmount: "50000",
  goalDays: "30",
  northStarMetric: "orders",
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
let coachApplyField = "audience";
let highestSetupStep = 1;
let goalCoachCache = "";

const CATEGORY_OPTIONS = new Set([
  "Homemade Indian pickles",
  "Snacks & namkeen",
  "Spices & masalas",
  "Sweets & mithai",
  "Health & wellness D2C",
  "Beauty & skincare D2C",
  "Fashion & accessories D2C",
  "Home & kitchen D2C",
]);

const DRAFT_STORAGE_VERSION = 1;
const DRAFT_SAVE_MS = 500;
const DRAFT_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

let draftSaveTimer = null;
let trackerSaveTimer = null;
let suppressDraftSave = false;
let experimentProgress = {};

const NORTH_STAR_LABELS = {
  orders: "Orders / revenue",
  list_size: "WhatsApp list / inquiries",
  repeat: "Repeat buyers",
  proof_of_hook: "Prove one hook works",
};

function experimentKey(weekIndex, expIndex) {
  return `${weekIndex}-${expIndex}`;
}

function getActiveCampaignRow() {
  return campaignHistory.find((c) => c.id === currentCampaignId) || null;
}

function getCampaignWeekInfo(input) {
  const row = getActiveCampaignRow();
  const metrics = row?.metrics || {};
  const started = metrics.campaignStartedAt || row?.created_at;
  const goalDays = parseNumber(input.goalDays) || 30;
  const totalWeeks = Math.max(Math.ceil(goalDays / 7), 1);
  const manual = parseNumber(document.querySelector("#manualWeek")?.value || metrics.manualWeek);
  let currentWeek = manual || null;
  if (!currentWeek && started) {
    const elapsed = Date.now() - new Date(started).getTime();
    currentWeek = Math.min(totalWeeks, Math.max(1, Math.floor(elapsed / (7 * 24 * 60 * 60 * 1000)) + 1));
  }
  if (!currentWeek) currentWeek = 1;
  const daysRemaining = started
    ? Math.max(0, goalDays - Math.floor((Date.now() - new Date(started).getTime()) / 86400000))
    : goalDays;
  return { currentWeek, totalWeeks, daysRemaining, startedAt: started };
}

function loadExperimentProgressFromMetrics(metrics = {}) {
  experimentProgress = { ...(metrics.experimentProgress || {}) };
}

function countCompletedExperiments() {
  return Object.values(experimentProgress).filter(Boolean).length;
}

function totalExperimentsInPlan() {
  const weeks = currentPlan?.weeklyPlan || [];
  return weeks.reduce((sum, week) => sum + (week.experiments || []).length, 0);
}

function buildPlanChangeSummary(learnings) {
  if (!learnings) return [];
  const bullets = [];
  const bestMsg = learnings.bestMessage || learnings.bestHook;
  if (bestMsg) bullets.push(`Leading with your best message: "${bestMsg.slice(0, 100)}${bestMsg.length > 100 ? "…" : ""}"`);
  if (learnings.bestChannel) bullets.push(`Doubling down on ${learnings.bestChannel}`);
  if (learnings.bestCreative) {
    bullets.push(`More creative like: ${learnings.bestCreative.slice(0, 80)}${learnings.bestCreative.length > 80 ? "…" : ""}`);
  }
  if (learnings.bestOffer) {
    bullets.push(`Offer angle: ${learnings.bestOffer.slice(0, 80)}${learnings.bestOffer.length > 80 ? "…" : ""}`);
  }
  if (learnings.repeat) bullets.push(`Repeat: ${learnings.repeat.slice(0, 100)}`);
  if (learnings.stop) bullets.push(`Stop: ${learnings.stop.slice(0, 100)}`);
  if (learnings.topObjection) bullets.push(`Addressing objection: ${learnings.topObjection}`);
  return bullets;
}

function renderPlanChangesCard(learnings) {
  const card = document.querySelector("#planChangesCard");
  const list = document.querySelector("#planChangesList");
  if (!card || !list) return;
  const bullets = buildPlanChangeSummary(learnings);
  if (!bullets.length) {
    card.classList.add("hidden");
    return;
  }
  card.classList.remove("hidden");
  list.innerHTML = bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("");
}

function getCampaignHealth(input, tracker) {
  const row = getActiveCampaignRow();
  if (!row || row.status === "closed" || !currentPlan) return null;
  const metrics = row.metrics || {};
  const messages = [];
  let level = "info";

  const goalDays = parseNumber(input.goalDays) || 30;
  const started = metrics.campaignStartedAt || row.created_at;
  const elapsedDays = started ? (Date.now() - new Date(started).getTime()) / 86400000 : 0;
  const goal = numberFromCurrency(input.revenueGoal);

  if (goal && elapsedDays > 3) {
    const expectedProgress = (elapsedDays / goalDays) * goal;
    if (tracker.revenue < expectedProgress * 0.5) {
      messages.push("Behind on revenue pace — focus on WhatsApp follow-ups this week.");
      level = "warn";
    }
  }

  const lastUpdate = metrics.trackerUpdatedAt;
  if (lastUpdate) {
    const daysSince = (Date.now() - new Date(lastUpdate).getTime()) / 86400000;
    if (daysSince >= 7) {
      messages.push("No tracker update in 7+ days — log numbers in Growth Tracker.");
      level = "warn";
    }
  } else if (elapsedDays >= 7) {
    messages.push("Save your first progress update in Growth Tracker.");
  }

  return messages.length ? { level, messages } : null;
}

function renderCampaignHealth(input, tracker) {
  const banner = document.querySelector("#campaignHealthBanner");
  if (!banner) return;
  const health = getCampaignHealth(input, tracker);
  if (!health) {
    banner.classList.add("hidden");
    banner.textContent = "";
    return;
  }
  banner.classList.remove("hidden");
  banner.classList.toggle("warn", health.level === "warn");
  banner.textContent = health.messages.join(" ");
}

function renderCampaignWeekUI(input) {
  const chip = document.querySelector("#campaignWeekChip");
  const topDays = document.querySelector("#topDaysRemaining");
  if (!currentPlan || !currentCampaignId) {
    chip?.classList.add("hidden");
    return;
  }
  const { currentWeek, totalWeeks, daysRemaining } = getCampaignWeekInfo(input);
  if (chip) {
    chip.textContent = `Week ${currentWeek} of ${totalWeeks}`;
    chip.classList.remove("hidden");
  }
  if (topDays) topDays.textContent = `${daysRemaining} days remaining`;
}

async function saveCampaignProgressToServer() {
  if (!currentCampaignId) return { saved: false };
  const tracker = getTrackerData();
  const manualWeek = document.querySelector("#manualWeek")?.value || "";
  try {
    const response = await fetch("/api/campaigns", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "save_progress",
        id: currentCampaignId,
        tracker,
        experimentProgress,
        manualWeek: manualWeek ? Number(manualWeek) : null,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to save progress");
    const row = campaignHistory.find((c) => c.id === currentCampaignId);
    if (row) {
      row.metrics = data.campaign?.metrics || row.metrics;
    }
    return { saved: true };
  } catch (error) {
    return { saved: false, error: error.message };
  }
}

async function toggleExperimentDone(key, done) {
  experimentProgress[key] = done;
  saveTrackerDraft();
  if (currentPlan) {
    const input = getFormInput();
    renderCommandCenter(currentPlan, input);
  }
  await saveCampaignProgressToServer();
}

function resolveCategory(data) {
  const selected = data.get("category")?.toString() || "";
  if (selected === "__custom") {
    return data.get("categoryCustom")?.toString().trim() || "";
  }
  return selected.trim();
}

function syncCategorySelect() {
  const select = document.querySelector("#categorySelect");
  const custom = document.querySelector("#categoryCustom");
  if (!select || !custom) return;
  const val = select.value;
  const showCustom = val === "__custom";
  custom.classList.toggle("hidden", !showCustom);
  if (showCustom) custom.required = true;
  else custom.required = false;
}

function draftStorageKey(brandName) {
  const slug = (brandName || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_") || "default";
  return `sa_draft_${slug}`;
}

function trackerStorageKey(campaignId) {
  return campaignId ? `sa_tracker_${campaignId}` : "sa_tracker_pending";
}

function isGoalStepComplete() {
  const data = new FormData(generatorForm);
  return (
    parseNumber(data.get("price")) > 0 &&
    parseNumber(data.get("goalAmount")) > 0 &&
    Boolean(data.get("orderChannel")) &&
    Boolean(data.get("deliveryArea")?.toString().trim()) &&
    data.getAll("channels").length > 0
  );
}

function isGoalMathReady() {
  const data = new FormData(generatorForm);
  return parseNumber(data.get("price")) > 0 && parseNumber(data.get("goalAmount")) > 0;
}

function shouldDisplayGoal() {
  if (currentPlan && currentCampaignId) return true;
  return isGoalStepComplete();
}

function getDiscoveryState() {
  return {
    intro: document.querySelector("#discoveryIntro")?.textContent || "",
    tasksHtml: document.querySelector("#discoveryTasks")?.innerHTML || "",
    interimWhatsapp: document.querySelector("#discoveryWhatsapp")?.textContent || "",
    interimReel: document.querySelector("#discoveryReel")?.textContent || "",
    returnVisible: !document.querySelector("#discoveryReturn")?.classList.contains("hidden"),
    whoFound: document.querySelector("#whoFound")?.value || "",
    areasFound: document.querySelector("#areasFound")?.value || "",
    substituteFound: document.querySelector("#substituteFound")?.value || "",
    hesitationFound: document.querySelector("#hesitationFound")?.value || "",
    panelOpen: !discoveryPanel?.classList.contains("hidden"),
  };
}

function applyDiscoveryState(state = {}) {
  if (!state || typeof state !== "object") return;
  const intro = document.querySelector("#discoveryIntro");
  const tasks = document.querySelector("#discoveryTasks");
  if (intro && state.intro) intro.textContent = state.intro;
  if (tasks && state.tasksHtml) tasks.innerHTML = state.tasksHtml;
  const wa = document.querySelector("#discoveryWhatsapp");
  const reel = document.querySelector("#discoveryReel");
  if (wa && state.interimWhatsapp) wa.textContent = state.interimWhatsapp;
  if (reel && state.interimReel) reel.textContent = state.interimReel;
  const who = document.querySelector("#whoFound");
  const areas = document.querySelector("#areasFound");
  const sub = document.querySelector("#substituteFound");
  const hes = document.querySelector("#hesitationFound");
  if (who && state.whoFound) who.value = state.whoFound;
  if (areas && state.areasFound) areas.value = state.areasFound;
  if (sub && state.substituteFound) sub.value = state.substituteFound;
  if (hes && state.hesitationFound) hes.value = state.hesitationFound;
  document.querySelector("#discoveryReturn")?.classList.toggle("hidden", !state.returnVisible);
  if (state.panelOpen && discoveryPanel) discoveryPanel.classList.remove("hidden");
}

function restoreUnsureFields() {
  for (const name of ["whoBuys", "whereLive", "substitute"]) {
    const hidden = generatorForm.elements.namedItem(`${name}Unsure`);
    const input = generatorForm.elements.namedItem(name);
    const toggle = generatorForm.querySelector(`[data-unsure-for="${name}"]`);
    const block = generatorForm.querySelector(`.audience-field[data-field="${name}"]`);
    const unsure = hidden?.value === "1";
    if (input) input.disabled = unsure;
    toggle?.classList.toggle("active", unsure);
    block?.classList.toggle("is-unsure", unsure);
  }
}

function serializeWizardDraft() {
  const data = new FormData(generatorForm);
  const fields = {};
  for (const key of new Set([...data.keys()])) {
    const values = data.getAll(key);
    fields[key] = values.length > 1 ? values : (values[0] ?? "");
  }
  fields.channels = data.getAll("channels");
  return {
    version: DRAFT_STORAGE_VERSION,
    savedAt: Date.now(),
    currentSetupStep,
    highestSetupStep,
    discoveryMode,
    discoveryOverride,
    fields,
    discovery: getDiscoveryState(),
  };
}

function applyWizardDraft(draft) {
  if (!draft?.fields) return;
  suppressDraftSave = true;
  const fields = draft.fields;

  for (const el of generatorForm.elements) {
    if (!el.name || el.type === "checkbox" || el.type === "radio") continue;
    if (fields[el.name] == null) continue;
    el.value = String(fields[el.name]);
  }

  const channels = fields.channels || [];
  generatorForm.querySelectorAll('input[name="channels"]').forEach((checkbox) => {
    checkbox.checked = channels.includes(checkbox.value);
  });

  const goalChoice = fields.goalChoice || "recommended";
  generatorForm.querySelectorAll('input[name="goalChoice"]').forEach((radio) => {
    radio.checked = radio.value === goalChoice;
  });

  const scope = fields.campaignScope || "single_sku";
  generatorForm.querySelectorAll('input[name="campaignScope"]').forEach((radio) => {
    radio.checked = radio.value === scope;
  });
  syncRevenueScopeLabels();

  discoveryMode = Boolean(draft.discoveryMode);
  discoveryOverride = Boolean(draft.discoveryOverride);
  applyDiscoveryState(draft.discovery || {});

  currentSetupStep = draft.currentSetupStep || 1;
  highestSetupStep = draft.highestSetupStep || currentSetupStep;
  syncCategorySelect();
  restoreUnsureFields();
  syncToneChipsFromInput();
  showSetupStep(currentSetupStep);
  suppressDraftSave = false;
}

function saveWizardDraft() {
  if (suppressDraftSave) return;
  const input = getFormInput();
  const key = draftStorageKey(input.brandName);
  try {
    localStorage.setItem(key, JSON.stringify(serializeWizardDraft()));
  } catch {
    /* storage full or private mode */
  }
}

function scheduleWizardDraftSave() {
  if (suppressDraftSave) return;
  clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(saveWizardDraft, DRAFT_SAVE_MS);
}

function clearWizardDraft(brandName) {
  try {
    localStorage.removeItem(draftStorageKey(brandName));
    localStorage.removeItem(`sa_discovery_${brandName}`);
  } catch {
    /* ignore */
  }
}

function findLatestWizardDraft() {
  let latest = null;
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key?.startsWith("sa_draft_")) continue;
    try {
      const data = JSON.parse(localStorage.getItem(key));
      if (!data?.fields || !data.savedAt) continue;
      if (Date.now() - data.savedAt > DRAFT_MAX_AGE_MS) continue;
      if (!latest || data.savedAt > latest.data.savedAt) latest = { key, data };
    } catch {
      /* skip corrupt entry */
    }
  }
  return latest;
}

function maybeResumeWizardDraft() {
  const latest = findLatestWizardDraft();
  if (!latest?.data?.fields) return false;
  const brand = latest.data.fields.brandName || "your brand";
  const saved = new Date(latest.data.savedAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
  if (!confirm(`Resume Brand Setup for "${brand}"? (saved ${saved})`)) return false;
  applyWizardDraft(latest.data);
  return true;
}

function populateManualWeekSelect(input) {
  const sel = document.querySelector("#manualWeek");
  if (!sel) return;
  const current = sel.value;
  const { totalWeeks } = getCampaignWeekInfo(input);
  const autoOpt = `<option value="">Auto (by days)</option>`;
  const weekOpts = Array.from({ length: totalWeeks }, (_, i) => {
    const w = i + 1;
    return `<option value="${w}">Week ${w}</option>`;
  }).join("");
  sel.innerHTML = autoOpt + weekOpts;
  if (current) sel.value = current;
}
function saveTrackerDraft() {
  const key = trackerStorageKey(currentCampaignId);
  const manualWeek = document.querySelector("#manualWeek")?.value || "";
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        savedAt: Date.now(),
        tracker: getTrackerData(),
        learnings: getCloseLearnings(),
        experimentProgress,
        manualWeek,
      }),
    );
  } catch {
    /* ignore */
  }
}

function scheduleTrackerSave() {
  clearTimeout(trackerSaveTimer);
  trackerSaveTimer = setTimeout(saveTrackerDraft, DRAFT_SAVE_MS);
}

function applyTrackerDraft(campaignId) {
  const raw = localStorage.getItem(trackerStorageKey(campaignId));
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    if (data.tracker) {
      for (const [key, value] of Object.entries(data.tracker)) {
        const field = trackerForm.elements.namedItem(key);
        if (field != null) field.value = value;
      }
    }
    if (data.learnings) {
      const map = {
        bestMessage: data.learnings.bestMessage || data.learnings.bestHook,
        bestCreative: data.learnings.bestCreative,
        bestOffer: data.learnings.bestOffer,
        bestHook: data.learnings.bestHook || data.learnings.bestMessage,
        repeatNext: data.learnings.repeat,
        stopDoing: data.learnings.stop,
      };
      for (const [key, value] of Object.entries(map)) {
        const field = trackerForm.elements.namedItem(key);
        if (field && value != null) field.value = value;
      }
      if (data.learnings.bestChannel) {
        const ch = trackerForm.elements.namedItem("bestChannel");
        if (ch) ch.value = data.learnings.bestChannel;
      }
      if (data.learnings.topObjection) {
        const sel = trackerForm.elements.namedItem("closeObjection");
        if (sel) sel.value = data.learnings.topObjection;
      }
    }
    if (data.experimentProgress) {
      experimentProgress = { ...data.experimentProgress };
    }
    if (data.manualWeek) {
      const sel = document.querySelector("#manualWeek");
      if (sel) sel.value = String(data.manualWeek);
    }
    return true;
  } catch {
    return false;
  }
}

function sanitizeOfferDraft(draft, input) {
  if (!draft) return draft;
  const priceNum = parseNumber(input.price);
  const clean = { ...draft };
  const scrub = (text) => {
    if (!text || !priceNum) return text;
    return String(text).replace(/Rs\.?\s*[\d,]+/gi, (match) => {
      const n = parseNumber(match);
      return n && n !== priceNum ? input.price : match;
    });
  };
  if (clean.productBundle) clean.productBundle = scrub(clean.productBundle);
  if (clean.clearVersion) clean.clearVersion = scrub(clean.clearVersion);
  if (clean.promoHook) clean.promoHook = scrub(clean.promoHook);
  return clean;
}

function buildGoalNarrative(intel, input) {
  const rec = compactGoal(intel.recommendedGoalString);
  const stretch = compactGoal(buildRevenueGoalString(intel.stretch, input.goalDays));
  const activeRec = input.goalChoice === "recommended";

  if (intel.isAbsurd) {
    return `Big jump from current revenue — prove ${rec} on WhatsApp before scaling.`;
  }
  if (activeRec) {
    return `Plan built for ${rec}. Pick "Use my number" above to plan for ${stretch} instead.`;
  }
  if (intel.isAggressive) {
    return `Plan uses phased prove-then-scale for ${stretch}. Safer starting point: ${rec}.`;
  }
  return "";
}

function allowedExperimentTypes(channels = []) {
  const allowed = new Set();
  for (const ch of channels) {
    const c = String(ch).toLowerCase();
    if (c.includes("reel")) allowed.add("reel");
    if (c.includes("whatsapp")) allowed.add("whatsapp");
    if (c.includes("website")) allowed.add("website");
    if (c.includes("linkedin")) allowed.add("linkedin");
    if (c.includes("email")) allowed.add("email");
  }
  return allowed;
}

function normalizeExperimentType(type = "") {
  const t = String(type).toLowerCase();
  if (t.includes("reel")) return "reel";
  if (t.includes("whatsapp")) return "whatsapp";
  if (t.includes("website")) return "website";
  if (t.includes("linkedin")) return "linkedin";
  if (t.includes("email")) return "email";
  return t;
}

function isEmptyExpField(value) {
  const t = (value || "").trim();
  return !t || t === "—" || t === "-";
}

function buildWhatsappOpsExtras(input) {
  const area = input.deliveryArea || input.whereLive || "your area";
  const price = input.price || "your price";
  const product = input.product || "product";
  const bundle = input.productBundle || input.offer || product;
  const promo = input.promoHook || "";
  const brand = input.brandName || "our brand";
  const channel = (input.orderChannel || "").toLowerCase();
  const isCod = channel.includes("cod");
  const paymentLine = isCod
    ? `Cash on delivery when we deliver to ${area}.`
    : `Please UPI ${price} before dispatch and send payment screenshot here.`;

  return {
    contactListGuide: `Week 1: message 20–30 warm contacts in ${area} (friends, neighbours, past tasters). Week 2+: add 10–15 Instagram/WhatsApp leads. Avoid cold strangers in week 1.`,
    replyYesScript: `Thanks! 🙏 Order: ${bundle} at ${price}. ${paymentLine} Please share full address + preferred delivery day.`,
    orderConfirmScript: `Order confirmed ✅ ${bundle} — delivery on [DAY] to [ADDRESS]. ${isCod ? "Keep exact change ready for COD." : "Payment received — thank you!"}`,
    deliveryScript: `Your ${product} is out for delivery today. We'll reach you between [TIME]. Reply if you need to reschedule.`,
    objectionPrice: `Fair question — ${price} for ${bundle}. ${promo ? `${promo}. ` : ""}Small-batch, not factory-made. Happy to share ingredients.`,
    objectionTrust: `Totally understand. ${brand} is founder-run — I deliver in ${area} myself. Try once; we'll make it right.`,
    objectionOily: `We use less oil than typical market pickles — non-oily line. Happy to share ingredients. Worth one try.`,
    objectionDefault: `Happy to help — what would make you comfortable to try once?`,
  };
}

function pickPrimaryObjection(input, ops) {
  const h = (input.hesitationLabel || input.hesitation || "").toLowerCase();
  if (h.includes("price")) return ops.objectionPrice;
  if (h.includes("trust") || h.includes("unknown")) return ops.objectionTrust;
  if (h.includes("oily") || h.includes("taste")) return ops.objectionOily;
  return ops.objectionDefault;
}

function enrichWhatsappPackClient(wa, input, weekIndex) {
  const area = input.deliveryArea || input.whereLive || "your delivery area";
  const price = input.price || "";
  const product = input.product || "product";
  const promo = input.promoHook || "";
  const bundle = input.productBundle || input.offer || product;
  const ops = buildWhatsappOpsExtras(input);
  const baseMessage =
    wa.message ||
    `Hi! I make ${bundle} at ${price}. ${promo ? `${promo}. ` : ""}Reply YES to order in ${area}.`;

  return {
    title: wa.title || `Week ${weekIndex + 1} broadcast`,
    message: baseMessage,
    photoBrief:
      wa.photoBrief ||
      `1 clear photo: ${product} jar, natural light, optional plate of food. No text on image.`,
    whoToMessage:
      wa.whoToMessage || `20–30 warm contacts in ${area} (friends, neighbours, past buyers)`,
    sendTime: wa.sendTime || "Tue or Wed, 7–9pm",
    replyScript: wa.replyScript || pickPrimaryObjection(input, ops),
    contactListGuide: wa.contactListGuide || ops.contactListGuide,
    replyYesScript: wa.replyYesScript || ops.replyYesScript,
    orderConfirmScript: wa.orderConfirmScript || ops.orderConfirmScript,
    deliveryScript: wa.deliveryScript || ops.deliveryScript,
    objectionPrice: wa.objectionPrice || ops.objectionPrice,
    objectionTrust: wa.objectionTrust || ops.objectionTrust,
    objectionOily: wa.objectionOily || ops.objectionOily,
    metric: wa.metric || "Reply rate and orders placed",
  };
}

function analyzeCapacityRisk(input) {
  const intel = computeGoalIntelligence(input);
  const ordersPerWeek = intel.ready ? intel.ordersPerWeek : 0;
  const reels = parseNumber(input.reelsPerWeek);
  const hours = parseNumber(input.hoursPerWeek);
  const messages = [];
  let level = "ok";

  if (ordersPerWeek > 15 && hours <= 3) {
    messages.push(
      `~${ordersPerWeek} orders/week is ambitious for ~${hours} hrs/week marketing — consider the recommended goal or more WhatsApp follow-ups.`,
    );
    level = "warn";
  }
  if (reels >= 4 && hours <= 3) {
    messages.push(`4+ Reels/week is hard in ~${hours} hours — the plan may overload you.`);
    level = level === "block" ? "block" : "warn";
  }
  if (ordersPerWeek > 25 && reels >= 4 && hours <= 5) {
    messages.push("This goal + Reel load is very unlikely solo — use recommended goal or cut Reels to 1–2/week.");
    level = "block";
  }
  if (hours <= 1 && ordersPerWeek > 8) {
    messages.push("~1 hour/week cannot sustain this order target — lower the goal or add marketing time.");
    level = "block";
  }

  return { level, messages, ordersPerWeek };
}

function syncRevenueScopeLabels() {
  const scope =
    generatorForm.querySelector('input[name="campaignScope"]:checked')?.value || "single_sku";
  const label = document.querySelector("#currentRevenueLabel");
  const hint = document.querySelector("#currentRevenueHint");
  if (!label || !hint) return;
  if (scope === "whole_brand") {
    label.textContent = "Last 30 days brand revenue (₹)";
    hint.textContent = "All products combined for the last 30 days.";
  } else {
    label.textContent = "Last 30 days revenue for this product (₹)";
    hint.textContent = "Use 0 if this SKU never sold. Use brand total only if you cannot split.";
  }
}

function syncDeliveryAreaHint() {
  const suggest = document.querySelector("#deliveryAreaSuggest");
  const where = generatorForm.elements.namedItem("whereLive")?.value?.trim() || "";
  const delivery = generatorForm.elements.namedItem("deliveryArea");
  if (!suggest || !delivery) return;

  if (!where) {
    suggest.classList.add("hidden");
    suggest.innerHTML = "";
    return;
  }

  const deliveryVal = delivery.value.trim();
  if (!deliveryVal) {
    suggest.classList.remove("hidden");
    suggest.innerHTML = `Customers live in: <strong>${escapeHtml(where)}</strong>. <button type="button" id="applyDeliverySuggest">Use as delivery area</button>`;
    return;
  }

  const whereLow = where.toLowerCase();
  const delLow = deliveryVal.toLowerCase();
  if (!whereLow.includes(delLow) && !delLow.includes(whereLow)) {
    suggest.classList.remove("hidden");
    suggest.textContent = `Note: customer areas (${where}) differ from delivery area — OK if you deliver wider.`;
    return;
  }

  suggest.classList.add("hidden");
  suggest.innerHTML = "";
}

function getDiscoveryFindings() {
  return {
    whoFound: document.querySelector("#whoFound")?.value?.trim() || "",
    areasFound: document.querySelector("#areasFound")?.value?.trim() || "",
    substituteFound: document.querySelector("#substituteFound")?.value?.trim() || "",
    hesitationFound: document.querySelector("#hesitationFound")?.value || "",
  };
}

function isDiscoveryFindingsAdequate(findings) {
  const substantive = [findings.whoFound, findings.areasFound, findings.substituteFound].filter(
    (t) => t.length >= 10,
  ).length;
  return substantive >= 2;
}

function updateDiscoveryMinBar() {
  const findings = getDiscoveryFindings();
  const adequate = isDiscoveryFindingsAdequate(findings);
  const hint = document.querySelector("#discoveryMinBarHint");
  if (!hint) return;
  hint.classList.toggle("hidden", adequate);
  hint.textContent = adequate
    ? ""
    : "Add real notes from 5+ conversations — at least 2 fields with 10+ characters each (who, areas, or substitute).";
}

function renderBriefAuditTrail(input) {
  const panel = document.querySelector("#briefAuditTrail");
  const body = document.querySelector("#briefAuditBody");
  if (!panel || !body) return;
  if (!currentPlan) {
    panel.classList.add("hidden");
    return;
  }
  panel.classList.remove("hidden");
  const scopeLabel =
    input.campaignScope === "whole_brand" ? "Whole brand" : `SKU: ${input.product}`;
  const rows = [
    ["Customer", input.audience || "—"],
    ["Goal", input.revenueGoal || "—"],
    ["North star", NORTH_STAR_LABELS[input.northStarMetric] || input.northStarMetric || "—"],
    ["Product", `${input.product} @ ${input.price}`],
    ["Scope", scopeLabel],
    ["Promo", input.promoHook || "—"],
    ["Channels", (input.channels || []).join(", ") || "—"],
    ["Capacity", input.contentCapacity || "—"],
    ["Delivery", input.deliveryArea || "—"],
    ["Orders via", input.orderChannel || "—"],
  ];
  body.innerHTML = rows
    .map(
      ([label, value]) =>
        `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`,
    )
    .join("");
}

function renderWhatsappOpsBlock(pack) {
  if (!pack) return "";
  return `
    <div class="wa-ops-block">
      <h5>When they reply</h5>
      <div class="wa-ops-row">
        <dt>If they say YES</dt>
        <dd>${escapeHtml(pack.replyYesScript || "—")}</dd>
        <button class="copy-btn small" data-copy-text="${escapeHtml(pack.replyYesScript || "")}" type="button">Copy YES reply</button>
      </div>
      <div class="wa-ops-row">
        <dt>Order confirmed</dt>
        <dd>${escapeHtml(pack.orderConfirmScript || "—")}</dd>
        <button class="copy-btn small" data-copy-text="${escapeHtml(pack.orderConfirmScript || "")}" type="button">Copy confirm</button>
      </div>
      <div class="wa-ops-row">
        <dt>Delivery day</dt>
        <dd>${escapeHtml(pack.deliveryScript || "—")}</dd>
        <button class="copy-btn small" data-copy-text="${escapeHtml(pack.deliveryScript || "")}" type="button">Copy delivery</button>
      </div>
      <h5>Objection replies</h5>
      <div class="wa-objections">
        <div class="wa-ops-row">
          <dt>Price</dt>
          <dd>${escapeHtml(pack.objectionPrice || "—")}</dd>
          <button class="copy-btn small" data-copy-text="${escapeHtml(pack.objectionPrice || "")}" type="button">Copy</button>
        </div>
        <div class="wa-ops-row">
          <dt>Trust</dt>
          <dd>${escapeHtml(pack.objectionTrust || "—")}</dd>
          <button class="copy-btn small" data-copy-text="${escapeHtml(pack.objectionTrust || "")}" type="button">Copy</button>
        </div>
        <div class="wa-ops-row">
          <dt>Oily / taste</dt>
          <dd>${escapeHtml(pack.objectionOily || "—")}</dd>
          <button class="copy-btn small" data-copy-text="${escapeHtml(pack.objectionOily || "")}" type="button">Copy</button>
        </div>
      </div>
    </div>
  `;
}

function normalizePlanClient(plan, input) {
  if (!plan || typeof plan !== "object") return plan;
  const allowed = allowedExperimentTypes(input.channels || []);
  const reels = plan.contentAssets?.reels || [];
  let whatsapp = (plan.contentAssets?.whatsapp || []).map((wa, i) =>
    enrichWhatsappPackClient(wa, input, i),
  );

  if (!plan.contentAssets) plan.contentAssets = {};
  plan.contentAssets.whatsapp = whatsapp;
  if (!allowed.has("website")) plan.contentAssets.website = [];
  if (!allowed.has("linkedin")) plan.contentAssets.linkedin = [];
  if (!allowed.has("reel")) plan.contentAssets.reels = [];
  if (!allowed.has("whatsapp")) plan.contentAssets.whatsapp = [];

  const priceNum = parseNumber(input.price);
  if (priceNum && plan.contentAssets.whatsapp) {
    plan.contentAssets.whatsapp = plan.contentAssets.whatsapp.map((wa) => {
      let message = wa.message || "";
      const wrongPrices = message.match(/Rs\.?\s*[\d,]+/gi) || [];
      for (const match of wrongPrices) {
        const n = parseNumber(match);
        if (n && n !== priceNum) message = message.replace(match, input.price);
      }
      return { ...wa, message };
    });
  }

  plan.weeklyPlan = (plan.weeklyPlan || []).map((week, weekIndex) => {
    const waPack = enrichWhatsappPackClient(whatsapp[weekIndex] || whatsapp[0] || {}, input, weekIndex);
    const reelAsset = reels[weekIndex] || reels[weekIndex % Math.max(reels.length, 1)] || {};

    let experiments = (week.experiments || []).map((exp) => {
      const kind = normalizeExperimentType(exp.type);
      if (kind === "reel" && (isEmptyExpField(exp.why) || isEmptyExpField(exp.action))) {
        const hook = reelAsset.hook || reelAsset.script || "";
        return {
          ...exp,
          why: isEmptyExpField(exp.why)
            ? `Reels build trust with ${(input.audience || "your buyer").slice(0, 60)}.`
            : exp.why,
          action: isEmptyExpField(exp.action)
            ? hook
              ? `Film 30s Reel: ${hook}`
              : `Film 30s Reel featuring ${input.product}.`
            : exp.action,
          cta: isEmptyExpField(exp.cta) ? reelAsset.cta || input.promoHook || "Order on WhatsApp" : exp.cta,
          metric: isEmptyExpField(exp.metric) ? "Saves and WhatsApp DMs" : exp.metric,
          decisionRule: isEmptyExpField(exp.decisionRule)
            ? "If 3+ saves or DMs, repeat this hook next week."
            : exp.decisionRule,
        };
      }
      if (kind === "whatsapp") {
        return {
          ...exp,
          why: isEmptyExpField(exp.why) ? "Warm contacts convert faster than cold outreach." : exp.why,
          action: isEmptyExpField(exp.action)
            ? `Send exact message below to: ${waPack.whoToMessage}`
            : exp.action,
          message: exp.message || waPack.message,
          photoBrief: exp.photoBrief || waPack.photoBrief,
          whoToMessage: exp.whoToMessage || waPack.whoToMessage,
          sendTime: exp.sendTime || waPack.sendTime,
          replyScript: exp.replyScript || waPack.replyScript,
          contactListGuide: exp.contactListGuide || waPack.contactListGuide,
          replyYesScript: exp.replyYesScript || waPack.replyYesScript,
          orderConfirmScript: exp.orderConfirmScript || waPack.orderConfirmScript,
          deliveryScript: exp.deliveryScript || waPack.deliveryScript,
          objectionPrice: exp.objectionPrice || waPack.objectionPrice,
          objectionTrust: exp.objectionTrust || waPack.objectionTrust,
          objectionOily: exp.objectionOily || waPack.objectionOily,
          cta: isEmptyExpField(exp.cta) ? waPack.message.slice(0, 100) : exp.cta,
          metric: isEmptyExpField(exp.metric) ? waPack.metric : exp.metric,
          decisionRule: isEmptyExpField(exp.decisionRule)
            ? "Under 2 replies? Send a personal voice note on day 3."
            : exp.decisionRule,
        };
      }
      return exp;
    }).filter((exp) => {
      const kind = normalizeExperimentType(exp.type);
      return kind === "offer" || allowed.has(kind);
    });

    if (allowed.has("whatsapp") && !experiments.some((e) => normalizeExperimentType(e.type) === "whatsapp")) {
      experiments.push({
        type: "WhatsApp",
        title: waPack.title,
        why: "Warm contacts convert faster than cold outreach.",
        action: `Send exact message below to: ${waPack.whoToMessage}`,
        message: waPack.message,
        photoBrief: waPack.photoBrief,
        whoToMessage: waPack.whoToMessage,
        sendTime: waPack.sendTime,
        replyScript: waPack.replyScript,
        contactListGuide: waPack.contactListGuide,
        replyYesScript: waPack.replyYesScript,
        orderConfirmScript: waPack.orderConfirmScript,
        deliveryScript: waPack.deliveryScript,
        objectionPrice: waPack.objectionPrice,
        objectionTrust: waPack.objectionTrust,
        objectionOily: waPack.objectionOily,
        cta: waPack.message.slice(0, 100),
        metric: waPack.metric,
        decisionRule: "Under 2 replies? Send a personal voice note on day 3.",
      });
    }
    if (allowed.has("reel") && !experiments.some((e) => normalizeExperimentType(e.type) === "reel")) {
      experiments.push({
        type: "Reel",
        title: reelAsset.title || "Reel",
        why: `Reels build trust with ${(input.audience || "your buyer").slice(0, 40)}.`,
        action: reelAsset.script || `Film 30s Reel featuring ${input.product}.`,
        cta: reelAsset.cta || input.promoHook || "Order on WhatsApp",
        metric: "Saves and DMs",
        decisionRule: "If 3+ saves, repeat hook next week.",
      });
    }

    return { ...week, experiments: experiments.slice(0, 2) };
  });

  return plan;
}

const VAGUE_PATTERN = /\b(everyone|all india|anyone|everybody|anybody)\b/i;
const JUNK_PATTERN = /\b(don'?t know|not sure|no idea|right\s*now)\b/i;

function setButtonLoading(btn, loading, loadingLabel = "Loading…") {
  if (!btn) return;
  if (loading) {
    if (!btn.dataset.defaultLabel) btn.dataset.defaultLabel = btn.textContent.trim();
    btn.classList.add("is-loading");
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined spin btn-spin" aria-hidden="true">sync</span> ${escapeHtml(loadingLabel)}`;
  } else {
    btn.classList.remove("is-loading");
    btn.disabled = false;
    btn.textContent = btn.dataset.defaultLabel || btn.textContent;
  }
}

function showStatus(el, message, isError = false) {
  if (!el) return;
  el.textContent = message || "";
  el.classList.toggle("hidden", !message);
  el.classList.toggle("inline-error", Boolean(message && isError));
}

function setCoachPanelLoading(loading) {
  document.querySelector("#coachLoading")?.classList.toggle("hidden", !loading);
  document.querySelector("#coachCompareBody")?.classList.toggle("hidden", loading);
  document.querySelector(".coach-panel-actions")?.classList.toggle("hidden", loading);
}

function isJunkText(text) {
  const t = (text || "").trim();
  if (t.length < 20) return true;
  if (JUNK_PATTERN.test(t) && t.length < 80) return true;
  return false;
}

function openCoachModal(result, applyField) {
  const input = getFormInput();
  if (applyField === "offer") result = sanitizeOfferDraft(result, input);
  pendingCoachDraft = result;
  coachApplyField = applyField;
  document.querySelector("#coachFounderText").textContent =
    result.founderSummary || result.clearVersion || "";
  const clearText =
    result.clearVersion ||
    (result.productBundle
      ? `${result.productBundle}${result.promoHook ? ` — ${result.promoHook}` : ""}`
      : "");
  document.querySelector("#coachClearText").textContent = clearText;
  setCoachPanelLoading(false);
  coachPanel.classList.remove("hidden");
}

function applyCoachFounderVersion() {
  if (!pendingCoachDraft) return;
  if (coachApplyField === "audience") {
    generatorForm.elements.namedItem("audience").value = pendingCoachDraft.founderSummary || "";
  } else if (coachApplyField === "brandMission") {
    generatorForm.elements.namedItem("brandMission").value = pendingCoachDraft.founderSummary || "";
  } else if (coachApplyField === "brandDifferentiation") {
    generatorForm.elements.namedItem("brandDifferentiation").value = pendingCoachDraft.founderSummary || "";
  }
  coachPanel.classList.add("hidden");
  updateDraftState();
  scheduleWizardDraftSave();
}

function syncToneChipsFromInput() {
  const toneField = generatorForm.elements.namedItem("brandTone");
  const selected = (toneField?.value || "")
    .toLowerCase()
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  document.querySelectorAll(".tone-chip").forEach((chip) => {
    chip.classList.toggle("active", selected.includes(chip.dataset.tone || ""));
  });
}

function toggleToneChip(chip) {
  const tone = chip.dataset.tone;
  if (!tone) return;
  const toneField = generatorForm.elements.namedItem("brandTone");
  const selected = new Set(
    (toneField?.value || "")
      .toLowerCase()
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
  if (selected.has(tone)) selected.delete(tone);
  else selected.add(tone);
  if (toneField) toneField.value = [...selected].join(", ");
  syncToneChipsFromInput();
  updateDraftState();
  scheduleWizardDraftSave();
}

function applyCoachClearVersion() {
  if (!pendingCoachDraft) return;
  const clear = pendingCoachDraft.clearVersion || "";
  if (coachApplyField === "audience") {
    generatorForm.elements.namedItem("audience").value = clear;
    if (pendingCoachDraft.hesitationLabel) {
      generatorForm.elements.namedItem("hesitationLabel").value = pendingCoachDraft.hesitationLabel;
    }
  } else if (coachApplyField === "brandMission") {
    generatorForm.elements.namedItem("brandMission").value = clear;
  } else if (coachApplyField === "brandDifferentiation") {
    generatorForm.elements.namedItem("brandDifferentiation").value = clear;
  } else if (coachApplyField === "offer") {
    const safe = sanitizeOfferDraft(pendingCoachDraft, getFormInput());
    if (safe.productBundle) {
      generatorForm.elements.namedItem("productBundle").value = safe.productBundle;
    }
    if (safe.promoHook != null) {
      generatorForm.elements.namedItem("promoHook").value = safe.promoHook;
    }
  }
  coachPanel.classList.add("hidden");
  updateDraftState();
  scheduleWizardDraftSave();
}

function toggleUnsure(fieldName) {
  const input = generatorForm.elements.namedItem(fieldName);
  const hidden = generatorForm.elements.namedItem(`${fieldName}Unsure`);
  const toggle = generatorForm.querySelector(`[data-unsure-for="${fieldName}"]`);
  const block = generatorForm.querySelector(`.audience-field[data-field="${fieldName}"]`);
  const active = hidden?.value === "1";
  if (hidden) hidden.value = active ? "" : "1";
  if (input) {
    if (!active) {
      input.dataset.prevValue = input.value;
      input.value = "";
      input.disabled = true;
    } else {
      input.disabled = false;
      input.value = input.dataset.prevValue || "";
    }
  }
  toggle?.classList.toggle("active", !active);
  block?.classList.toggle("is-unsure", !active);
  scheduleWizardDraftSave();
}

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
  const val = (name) => {
    if (data.get(`${name}Unsure`) === "1") return "not_sure";
    return data.get(name)?.toString().trim() || "";
  };
  return {
    whoBuys: val("whoBuys"),
    whereLive: val("whereLive"),
    substitute: val("substitute"),
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
  const stretch = parseNumber(input.stretchGoalAmount ?? input.goalAmount);
  const days = parseNumber(input.goalDays) || 30;
  const price = parseNumber(input.price);
  const empty = {
    recommended: 0,
    stretch: 0,
    recommendedOrders: 0,
    stretchOrders: 0,
    recommendedOrdersPerWeek: 0,
    stretchOrdersPerWeek: 0,
    ordersNeeded: 0,
    ordersPerWeek: 0,
    isAggressive: false,
    isAbsurd: false,
    explanation: "Enter a revenue goal and price to see if it's realistic.",
    recommendedGoalString: "--",
    stretchGoalString: "--",
    ready: false,
  };

  if (!stretch || !price) return empty;

  const stretchOrders = Math.ceil(stretch / price);
  const weeks = Math.max(days / 7, 1);
  const stretchOrdersPerWeek = Math.ceil(stretchOrders / weeks);

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

  const recommendedOrders = Math.ceil(recommended / price);
  const recommendedOrdersPerWeek = Math.ceil(recommendedOrders / weeks);

  const base = Math.max(current, 1000);
  const ratio = stretch / base;
  const isAggressive = ratio > 4 || (current < 1000 && stretch > 15000);
  const isAbsurd = ratio > 15 || (current < 1000 && stretch >= 50000);

  const activeOrders = input.goalChoice === "stretch" ? stretchOrders : recommendedOrders;
  const activePerWeek =
    input.goalChoice === "stretch" ? stretchOrdersPerWeek : recommendedOrdersPerWeek;

  let explanation = `You entered ${formatRupee(stretch)} in ${days} days = ~${stretchOrders} orders (~${stretchOrdersPerWeek}/week) at ${input.price || "your price"}.`;
  if (input.goalChoice === "recommended") {
    explanation += ` Recommended safer target: ${formatRupee(recommended)} (~${recommendedOrdersPerWeek} orders/week).`;
  }
  if (isAbsurd) {
    explanation += " That jump is very large — start with recommended first.";
  } else if (isAggressive && input.goalChoice === "stretch") {
    explanation += " Stretch selected — plan may split into prove-then-scale phases.";
  }

  return {
    recommended,
    stretch,
    recommendedOrders,
    stretchOrders,
    recommendedOrdersPerWeek,
    stretchOrdersPerWeek,
    ordersNeeded: activeOrders,
    ordersPerWeek: activePerWeek,
    isAggressive,
    isAbsurd,
    explanation,
    recommendedGoalString: buildRevenueGoalString(recommended, days),
    stretchGoalString: buildRevenueGoalString(stretch, days),
    ready: true,
  };
}

function getFormInput() {
  const data = new FormData(generatorForm);
  const stretchGoalAmount = data.get("goalAmount")?.toString().trim() || "";
  const goalDays = data.get("goalDays")?.toString().trim() || "30";
  const goalChoice = data.get("goalChoice")?.toString() || "recommended";
  const priceRaw = data.get("price")?.toString().trim() || "";
  const revenueRaw = data.get("currentRevenue")?.toString().trim() || "";

  const goalIntel = computeGoalIntelligence({
    currentRevenue: formatRupee(parseNumber(revenueRaw)),
    stretchGoalAmount,
    goalAmount: stretchGoalAmount,
    goalDays,
    brandStage: data.get("brandStage")?.toString() || "",
    price: formatRupee(parseNumber(priceRaw)),
    goalChoice,
  });

  const activeGoalAmount = !stretchGoalAmount
    ? ""
    : goalChoice === "recommended" && goalIntel.recommended
      ? String(goalIntel.recommended)
      : stretchGoalAmount;

  const productBundle = data.get("productBundle")?.toString().trim() || data.get("offer")?.toString().trim() || "";
  const promoHook = data.get("promoHook")?.toString().trim() || "";

  const reelsPerWeek = data.get("reelsPerWeek")?.toString() || "2";
  const hoursPerWeek = data.get("hoursPerWeek")?.toString() || "3";

  // Plan v2 capacity + goal fields
  const winningGoal = data.get("winningGoal")?.toString() || "";
  const whatsappContacts = data.get("whatsappContacts")?.toString().trim() || "";
  const hasBroadcastList = data.get("hasBroadcastList")?.toString() || "";
  const broadcastListSize = data.get("broadcastListSize")?.toString().trim() || "";
  const whatsappFrequency = data.get("whatsappFrequency")?.toString() || "";
  const instagramFollowers = data.get("instagramFollowers")?.toString() || "";
  const cameraComfort = data.get("cameraComfort")?.toString() || "";
  const instagramStories = data.get("instagramStories")?.toString() || "";
  const channelsSel = data.getAll("channels").map((c) => c.toString());
  const waSelected = channelsSel.some((c) => c.toLowerCase().includes("whatsapp"));

  // Back-compat derivations so the (fenced) plan prompt still gets what it reads.
  const whatsappBroadcasts = waSelected ? "yes" : "no";
  const storiesPerWeek = /^yes$/i.test(instagramStories) ? "yes" : "no";
  const onCamera = cameraComfort.startsWith("Yes") ? "yes" : "no";
  const northStarMetric = winningGoalToMetric(winningGoal);

  const capacityObj = { reelsPerWeek, whatsappBroadcasts, storiesPerWeek, onCamera, hoursPerWeek };
  const contentCapacity = buildContentCapacity(capacityObj);
  const campaignScope = data.get("campaignScope")?.toString() || "single_sku";
  const capacityRisk = analyzeCapacityRisk({
    ...{
      currentRevenue: formatRupee(parseNumber(revenueRaw)),
      stretchGoalAmount,
      goalAmount: stretchGoalAmount,
      goalDays,
      brandStage: data.get("brandStage")?.toString() || "",
      price: formatRupee(parseNumber(priceRaw)),
      goalChoice,
      reelsPerWeek,
      whatsappBroadcasts,
      hoursPerWeek,
      channels: data.getAll("channels").map((c) => c.toString()),
    },
  });

  const audience = data.get("audience")?.toString().trim() || "";
  const hesitationLabel = data.get("hesitationLabel")?.toString().trim() || data.get("hesitation")?.toString() || "";

  return {
    brandName: data.get("brandName")?.toString().trim() || "",
    category: resolveCategory(data),
    campaignScope,
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
    revenueGoal: activeGoalAmount ? buildRevenueGoalString(activeGoalAmount, goalDays) : "",
    goalAmount: activeGoalAmount,
    stretchGoalAmount,
    stretchGoal: buildRevenueGoalString(stretchGoalAmount, goalDays),
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
    capacityRiskLevel: capacityRisk.level,
    capacityNote: capacityRisk.messages.join(" "),
    brandTone: data.get("brandTone")?.toString().trim() || "",
    brandMission: data.get("brandMission")?.toString().trim() || "",
    brandDifferentiation: data.get("brandDifferentiation")?.toString().trim() || "",
    brandStage: data.get("brandStage")?.toString().trim() || "",
    pastFailures: data.get("pastFailures")?.toString().trim() || "",
    channels: channelsSel,
    northStarMetric,
    winningGoal,
    whatsappContacts,
    hasBroadcastList,
    broadcastListSize,
    whatsappFrequency,
    instagramFollowers,
    cameraComfort,
    instagramStories,
    whatCanProve: data.get("whatCanProve")?.toString().trim() || "",
    customerVoice: data.get("customerVoice")?.toString().trim() || "",
    competitorsCantCopy: data.get("competitorsCantCopy")?.toString().trim() || "",
    discoveryMode: discoveryMode && !discoveryOverride,
    discoveryOverride,
  };
}

function winningGoalToMetric(winningGoal) {
  const g = String(winningGoal || "").toLowerCase();
  if (g.includes("list")) return "list_size";
  if (g.includes("repeat")) return "repeat";
  if (g.includes("test") || g.includes("messaging")) return "proof_of_hook";
  return "orders";
}

function validateStep(step) {
  const data = new FormData(generatorForm);
  const errors = [];
  if (step === 1) {
    if (!data.get("brandName")?.toString().trim()) errors.push("Brand name is required.");
    if (!data.get("product")?.toString().trim()) errors.push("Product is required.");
    if (!parseNumber(data.get("price"))) errors.push("Enter a valid price.");
    if (!data.get("orderChannel")) errors.push("Select how customers order.");
    if (!data.get("deliveryArea")?.toString().trim()) errors.push("Where do you deliver? is required.");
  }
  if (step === 2) {
    const fieldsHidden = document.querySelector("#step2Fields")?.classList.contains("hidden");
    if (fieldsHidden && !discoveryMode) {
      errors.push("Answer the question above to continue.");
    } else if (!discoveryMode) {
      if (!data.get("audienceConfidence")) errors.push("Tell us how sure you are about your customer.");
      const answers = getAudienceAnswers();
      if (needsDiscovery(answers) && !data.get("audience")?.toString().trim()) {
        errors.push("We need a short customer summary — try Discovery Week or click Help me write my customer summary.");
      }
    }
  }
  if (step === 3) {
    if (!data.get("productBundle")?.toString().trim()) errors.push("Describe what's in the jar/box.");
  }
  if (step === 4) {
    if ((data.get("brandDifferentiation")?.toString().trim() || "").length < 10) {
      errors.push("What makes you different: 10+ characters or use the coach.");
    }
  }
  if (step === 5) {
    if (!data.get("winningGoal")) errors.push("Pick what winning looks like.");
    if (!parseNumber(data.get("goalAmount"))) errors.push("Enter a revenue goal.");
    if (!data.getAll("channels").length) errors.push("Select at least one channel.");
  }
  showStatus(document.querySelector("#wizardStepError"), errors[0] || "", true);
  return errors;
}

function showSetupStep(step) {
  currentSetupStep = step;
  highestSetupStep = Math.max(highestSetupStep, step);
  generatorForm.querySelectorAll("[data-setup-step]").forEach((el) => {
    el.classList.toggle("hidden", Number(el.dataset.setupStep) !== step);
  });
  document.querySelectorAll("#setupWizardNav .wizard-step").forEach((btn) => {
    const n = Number(btn.dataset.step);
    btn.classList.toggle("active", n === step);
    btn.classList.toggle("completed", n < step);
  });
  document.querySelector("#wizardPrev").classList.toggle("hidden", step === 1);
  document.querySelector("#wizardNext").classList.toggle("hidden", step === 5);
  document.querySelector("#openBriefBtn").classList.toggle("hidden", step !== 5);
  document.querySelector("#step5Hint")?.classList.toggle("hidden", step !== 5);
  showStatus(document.querySelector("#wizardStepError"), "");
  if (step === 5) {
    void renderGoalIntelligence();
    syncPlanConditionals();
    syncCrossChannelWarnings();
  }
  updateDraftState();
  scheduleWizardDraftSave();
}

function renderGoalIntelligence() {
  const input = getFormInput();
  const intel = computeGoalIntelligence(input);
  const summary = document.querySelector("#goalIntelSummary");
  const warn = document.querySelector("#goalWarning");
  const narrativeEl = document.querySelector("#goalCoachNarrative");
  const channelWarn = document.querySelector("#channelWarning");
  const capacityWarn = document.querySelector("#capacityWarning");
  const enteredNote = document.querySelector("#goalEnteredNote");
  const goalOptions = document.querySelector("#goalOptions");

  if (!intel.ready) {
    summary.classList.remove("hidden");
    summary.textContent = isGoalMathReady()
      ? intel.explanation
      : "Fill price (Step 1) and revenue goal to see the math.";
    if (enteredNote) enteredNote.textContent = "You entered: —";
    if (narrativeEl) narrativeEl.textContent = "";
    goalOptions?.classList.add("hidden");
    warn?.classList.add("hidden");
    channelWarn?.classList.add("hidden");
    capacityWarn?.classList.add("hidden");
    return;
  }

  goalOptions?.classList.remove("hidden");
  summary.classList.add("hidden");
  summary.textContent = "";
  if (enteredNote) {
    enteredNote.textContent = `You entered ${compactGoal(intel.stretchGoalString)} in ${input.goalDays || 30} days (~${intel.stretchOrdersPerWeek} orders/week at ${input.price || "your price"}).`;
  }

  document.querySelector("#recommendedGoalLabel").textContent = `Recommended (safer): ${compactGoal(intel.recommendedGoalString)}`;
  document.querySelector("#recommendedGoalNote").textContent = `${intel.recommendedOrders} orders (~${intel.recommendedOrdersPerWeek}/week).`;
  document.querySelector("#stretchGoalLabel").textContent = `Use my number: ${compactGoal(intel.stretchGoalString)}`;
  document.querySelector("#stretchGoalNote").textContent = `${intel.stretchOrders} orders (~${intel.stretchOrdersPerWeek}/week).`;

  warn.classList.toggle("hidden", !intel.isAggressive || input.goalChoice !== "stretch");
  if (intel.isAbsurd) {
    warn.textContent =
      "This goal is a big jump from where you are. We strongly recommend starting with the recommended goal.";
  } else if (intel.isAggressive) {
    warn.textContent = "Stretch goal — plan splits Phase 1 (prove) and Phase 2 (scale).";
  }

  const narrative = buildGoalNarrative(intel, input);
  if (narrativeEl) {
    narrativeEl.textContent = narrative;
    narrativeEl.classList.toggle("hidden", !narrative);
  }
  goalCoachCache = narrative;

  const stage = input.brandStage || "";
  const channelCount = input.channels.length;
  if ((stage.includes("First sales") || stage.includes("Idea")) && channelCount > 2) {
    channelWarn.textContent = "Early stage: pick 2 channels max. WhatsApp + Reels usually work best.";
    channelWarn.classList.remove("hidden");
    channelWarn.classList.add("warn");
  } else {
    channelWarn.classList.add("hidden");
    channelWarn.classList.remove("warn");
  }

  const reels = parseNumber(input.reelsPerWeek);
  const hours = parseNumber(input.hoursPerWeek);
  if (reels >= 4 && hours <= 3) {
    capacityWarn.textContent = "4+ Reels/week is hard in ~3 hours — consider 1–2 Reels + WhatsApp.";
    capacityWarn.classList.remove("hidden");
    capacityWarn.classList.add("warn");
  } else if (reels >= 6) {
    capacityWarn.textContent = "6 Reels/week is a lot for a solo founder — be honest or plan will fail.";
    capacityWarn.classList.remove("hidden");
    capacityWarn.classList.add("warn");
  } else {
    capacityWarn.classList.add("hidden");
    capacityWarn.classList.remove("warn");
  }

  const capField = generatorForm.elements.namedItem("contentCapacity");
  if (capField) capField.value = input.contentCapacity;

  const blockWarn = document.querySelector("#capacityBlockWarning");
  const risk = analyzeCapacityRisk(input);
  if (blockWarn) {
    if (risk.messages.length) {
      blockWarn.textContent = risk.messages.join(" ");
      blockWarn.classList.remove("hidden");
      blockWarn.classList.toggle("warn", risk.level !== "block");
      blockWarn.classList.toggle("inline-error", risk.level === "block");
    } else {
      blockWarn.classList.add("hidden");
      blockWarn.textContent = "";
    }
  }
}

function applyInputToForm(input) {
  const map = {
    brandName: input.brandName,
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
    northStarMetric: input.northStarMetric || "orders",
  };

  for (const [key, value] of Object.entries(map)) {
    const field = generatorForm.elements.namedItem(key);
    if (field && value != null) field.value = value;
  }

  const categorySelect = document.querySelector("#categorySelect");
  const categoryCustom = document.querySelector("#categoryCustom");
  const cat = input.category || "";
  if (categorySelect) {
    if (CATEGORY_OPTIONS.has(cat)) {
      categorySelect.value = cat;
      if (categoryCustom) categoryCustom.value = "";
    } else if (cat) {
      categorySelect.value = "__custom";
      if (categoryCustom) categoryCustom.value = cat;
    }
    syncCategorySelect();
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

  const scope = input.campaignScope || "single_sku";
  generatorForm.querySelectorAll('input[name="campaignScope"]').forEach((radio) => {
    radio.checked = radio.value === scope;
  });
  syncRevenueScopeLabels();

  discoveryMode = Boolean(input.discoveryMode);
  discoveryOverride = Boolean(input.discoveryOverride);
  syncToneChipsFromInput();
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
  const bestMessage = data.get("bestMessage")?.toString().trim() || "";
  const bestHook = data.get("bestHook")?.toString().trim() || bestMessage;
  return {
    bestMessage: bestMessage || bestHook,
    bestHook: bestHook || bestMessage,
    bestCreative: data.get("bestCreative")?.toString().trim() || "",
    bestChannel: data.get("bestChannel")?.toString().trim() || "",
    bestOffer: data.get("bestOffer")?.toString().trim() || "",
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
  const btn = document.querySelector("#coachAudienceBtn");

  try {
    if (needsDiscovery(answers)) {
      await openDiscoveryWeek();
      showStatus(status, "Discovery Week opened — do the checklist first.");
      return;
    }

    setButtonLoading(btn, true, "Writing…");
    coachPanel.classList.remove("hidden");
    setCoachPanelLoading(true);
    const result = await callCoach("audience_draft", { input, answers });
    openCoachModal(result, "audience");
    showStatus(status, "Review the clear version in the popup.");
  } catch (error) {
    showStatus(status, error.message, true);
    coachPanel.classList.add("hidden");
  } finally {
    setButtonLoading(btn, false);
  }
}

async function runMissionCoach() {
  const input = getFormInput();
  const data = new FormData(generatorForm);
  const btn = document.querySelector("#coachMissionBtn");
  const status = document.querySelector("#missionCoachStatus");
  const answers = {
    whyStarted: data.get("missionWhyStarted")?.toString() || "",
    emotionalMoment: data.get("missionEmotional")?.toString() || "",
    customerFeel: data.get("missionCustomerFeel")?.toString() || "",
  };

  try {
    setButtonLoading(btn, true, "Writing…");
    coachPanel.classList.remove("hidden");
    setCoachPanelLoading(true);
    const result = await callCoach("mission_draft", { input, answers });
    if (result.isSubstantive === false || !result.clearVersion) {
      coachPanel.classList.add("hidden");
      showStatus(status, "Add rough notes above or use Discovery Week — we won't invent a fake mission.", true);
      return;
    }
    openCoachModal(result, "brandMission");
    showStatus(status, "Mission draft ready — pick clear version if it fits.");
  } catch (error) {
    showStatus(status, error.message, true);
    coachPanel.classList.add("hidden");
  } finally {
    setButtonLoading(btn, false);
  }
}

async function runDiffCoach() {
  const input = getFormInput();
  const data = new FormData(generatorForm);
  const btn = document.querySelector("#coachDiffBtn");
  const status = document.querySelector("#diffCoachStatus");
  const answers = {
    provable: data.get("diffProvable")?.toString() || "",
    customerSays: data.get("diffCustomerSays")?.toString() || "",
    cannotCopy: data.get("diffCannotCopy")?.toString() || "",
  };

  try {
    setButtonLoading(btn, true, "Writing…");
    coachPanel.classList.remove("hidden");
    setCoachPanelLoading(true);
    const result = await callCoach("differentiation_draft", { input, answers });
    openCoachModal(result, "brandDifferentiation");
    showStatus(status, "Differentiation draft ready.");
  } catch (error) {
    showStatus(status, error.message, true);
    coachPanel.classList.add("hidden");
  } finally {
    setButtonLoading(btn, false);
  }
}

async function runOfferCoach() {
  const input = getFormInput();
  const data = new FormData(generatorForm);
  const btn = document.querySelector("#coachOfferBtn");
  const status = document.querySelector("#offerCoachStatus");
  const answers = {
    bundleDetail: data.get("productBundle")?.toString() || data.get("offerBundleDetail")?.toString() || "",
    sizeVariant: data.get("offerSizeVariant")?.toString() || "",
    promoWhy: data.get("promoHook")?.toString() || data.get("offerPromoWhy")?.toString() || "",
    promoType: data.get("offerPromoType")?.toString() || "",
  };

  try {
    setButtonLoading(btn, true, "Building…");
    coachPanel.classList.remove("hidden");
    setCoachPanelLoading(true);
    const result = await callCoach("offer_draft", { input, answers });
    openCoachModal(result, "offer");
    showStatus(status, "Offer draft ready — promo will show in WhatsApp & Reels.");
  } catch (error) {
    showStatus(status, error.message, true);
    coachPanel.classList.add("hidden");
  } finally {
    setButtonLoading(btn, false);
  }
}

async function openDiscoveryWeek() {
  const input = getFormInput();
  discoveryMode = true;
  const status = document.querySelector("#discoveryStatus");
  const btn = document.querySelector("#startDiscoveryBtn");
  showStatus(status, "Building your 1-week checklist…");
  scheduleWizardDraftSave();

  try {
    setButtonLoading(btn, true, "Building…");
    discoveryPanel.classList.remove("hidden");
    document.querySelector("#discoveryTasks").innerHTML =
      '<p class="coach-loading"><span class="material-symbols-outlined spin">sync</span> Creating tasks…</p>';
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
    showStatus(status, "");
    saveWizardDraft();
  } catch (error) {
    showStatus(status, error.message, true);
  } finally {
    setButtonLoading(btn, false);
  }
}

async function synthesizeDiscovery() {
  const input = getFormInput();
  const findings = getDiscoveryFindings();
  const status = document.querySelector("#discoveryStatus");
  const btn = document.querySelector("#synthesizeDiscoveryBtn");

  if (!isDiscoveryFindingsAdequate(findings)) {
    if (
      !confirm(
        "Your notes look thin. We recommend 5+ real conversations first. Build customer summary anyway?",
      )
    ) {
      updateDiscoveryMinBar();
      return;
    }
  }

  showStatus(status, "Turning your notes into a customer summary…");

  try {
    setButtonLoading(btn, true, "Saving…");
    const result = await callCoach("discovery_synthesize", { input, findings });
    generatorForm.elements.namedItem("audience").value = result.audience || "";
    generatorForm.elements.namedItem("hesitationLabel").value = result.hesitationLabel || "";
    // Auto-populate the Buyer fields from discovery findings + flag them.
    applyDiscoveryToBuyerFields(result, findings);
    discoveryMode = false;
    discoveryOverride = false;
    discoveryPanel.classList.add("hidden");
    revealStep2Fields();
    showStatus(status, result.confidenceNote || "Customer summary saved.");
    document.querySelector("#audienceCoachStatus").textContent =
      "Nice — you talked to real people. That's real data.";
    saveWizardDraft();
    showSetupStep(2);
  } catch (error) {
    showStatus(status, error.message, true);
  } finally {
    setButtonLoading(btn, false);
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

  const btn = document.querySelector("#structureFailuresBtn");
  try {
    setButtonLoading(btn, true, "Writing…");
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
  } finally {
    setButtonLoading(btn, false);
  }
}

async function runCloseDebriefCoach() {
  const input = getFormInput();
  const tracker = getTrackerData();
  const learnings = getCloseLearnings();
  const btn = document.querySelector("#coachCloseBtn");
  const status = document.querySelector("#closeCampaignStatus");

  try {
    setButtonLoading(btn, true, "Writing…");
    const result = await callCoach("close_debrief", {
      input,
      learnings: {
        ...learnings,
        finalOrders: tracker.orders,
        finalRevenue: tracker.revenue,
      },
    });
    if (result.bestMessage) trackerForm.elements.namedItem("bestMessage").value = result.bestMessage;
    if (result.bestCreative) trackerForm.elements.namedItem("bestCreative").value = result.bestCreative;
    if (result.bestChannel) trackerForm.elements.namedItem("bestChannel").value = result.bestChannel;
    if (result.bestOffer) trackerForm.elements.namedItem("bestOffer").value = result.bestOffer;
    if (result.bestHook) trackerForm.elements.namedItem("bestHook").value = result.bestHook;
    if (result.topObjection) {
      const sel = trackerForm.elements.namedItem("closeObjection");
      const match = [...sel.options].find((o) => o.value === result.topObjection);
      if (match) sel.value = result.topObjection;
      else trackerForm.elements.namedItem("topObjection").value = result.topObjection;
    }
    if (result.repeat) trackerForm.elements.namedItem("repeatNext").value = result.repeat;
    if (result.stop) trackerForm.elements.namedItem("stopDoing").value = result.stop;
    showStatus(status, result.summary || "Learnings drafted — edit if needed, then close campaign.");
    updateDraftState();
  } catch (error) {
    showStatus(status, error.message, true);
  } finally {
    setButtonLoading(btn, false);
  }
}

function renderBriefReview() {
  const input = getFormInput();
  const intel = computeGoalIntelligence(input);
  const showGoal = shouldDisplayGoal();
  document.querySelector("#briefReview").innerHTML = `
    <div class="brief-review-block"><span class="label">Customer</span><p>${escapeHtml(input.audience || "—")}</p></div>
    <div class="brief-review-block"><span class="label">Mission</span><p>${escapeHtml(input.brandMission || "—")}</p></div>
    <div class="brief-review-block"><span class="label">Different</span><p>${escapeHtml(input.brandDifferentiation || "—")}</p></div>
    <div class="brief-review-block"><span class="label">Product</span><p>${escapeHtml(input.productBundle)}</p></div>
    <div class="brief-review-block"><span class="label">Promo hook</span><p>${escapeHtml(input.promoHook || "None")}</p></div>
    ${showGoal ? `<div class="brief-review-block"><span class="label">Goal (active)</span><p>${escapeHtml(input.revenueGoal)} ${input.goalChoice === "stretch" && intel.isAggressive ? "(phased plan)" : ""}</p></div>
    <div class="brief-review-block"><span class="label">You entered</span><p>${escapeHtml(input.stretchGoal || input.revenueGoal)}</p></div>
    <div class="brief-review-block"><span class="label">Goal coach</span><p>${escapeHtml(goalCoachCache || buildGoalNarrative(intel, input))}</p></div>` : `<div class="brief-review-block"><span class="label">Goal</span><p>Complete Step 4 to set your campaign goal.</p></div>`}
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

function loadCampaignFromHistory(id, { duplicate = false, detail = false } = {}) {
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
  loadExperimentProgressFromMetrics(row.metrics || {});
  populateManualWeekSelect({ ...getFormInput(), ...input });
  renderPlan(plan, { ...getFormInput(), ...input });

  const metrics = row.metrics?.tracker;
  if (metrics) {
    for (const [key, value] of Object.entries(metrics)) {
      const field = trackerForm.elements.namedItem(key);
      if (field) field.value = value;
    }
  }
  applyTrackerDraft(row.id);

  const manualWeek = row.metrics?.manualWeek;
  if (manualWeek) {
    const sel = document.querySelector("#manualWeek");
    if (sel) sel.value = String(manualWeek);
  }

  const learnings = row.metrics?.learnings;
  if (learnings) {
    const objectionField = trackerForm.elements.namedItem("closeObjection");
    if (objectionField && learnings.topObjection) objectionField.value = learnings.topObjection;
    const map = {
      bestMessage: learnings.bestMessage || learnings.bestHook,
      bestCreative: learnings.bestCreative,
      bestOffer: learnings.bestOffer,
      bestHook: learnings.bestHook || learnings.bestMessage,
      repeatNext: learnings.repeat,
      stopDoing: learnings.stop,
    };
    for (const [key, value] of Object.entries(map)) {
      const field = trackerForm.elements.namedItem(key);
      if (field && value) field.value = value;
    }
    if (learnings.bestChannel) {
      const ch = trackerForm.elements.namedItem("bestChannel");
      if (ch) ch.value = learnings.bestChannel;
    }
  }

  renderPlanChangesCard(null);

  if (detail) {
    renderDetailHeader(row);
    switchView("campaign-detail");
    if (location.pathname !== `/campaign/${id}`) {
      history.pushState({ campaignId: id }, "", `/campaign/${id}`);
    }
  } else {
    switchView("campaign");
  }
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

function briefRupee(v) {
  const digits = String(v || "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  return "₹" + Number(digits).toLocaleString("en-IN");
}

function briefChannels(channels) {
  return (channels || [])
    .map((c) => c.replace(/\s*campaign$/i, "").trim())
    .filter(Boolean)
    .join(", ");
}

// Progressive Operator Brief — sections and lines appear only when their
// source field has a value. Data comes entirely from getFormInput() (live
// form values); this function only decides what to show.
function renderOperatorBrief(input) {
  const titleEl = document.querySelector("#briefTitle");
  const body = document.querySelector("#briefBody");
  if (!body || !titleEl) return;

  if (input.product) {
    const monthYear = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
    titleEl.textContent = `${input.product} — ${monthYear}`;
  } else {
    titleEl.textContent = "Your growth brief";
  }

  const sections = [
    {
      heading: "PRODUCT",
      trigger: input.product,
      lines: [
        ["Product", input.product],
        ["Price", briefRupee(input.price)],
        ["Order channel", input.orderChannel],
        ["Delivery", input.deliveryArea],
      ],
    },
    {
      heading: "BUYER",
      trigger: input.whoBuys,
      lines: [
        ["Customer", input.whoBuys],
        ["Location", input.whereLive],
        ["Instead of", input.substitute],
        ["Hesitation", input.hesitationLabel || input.hesitation],
      ],
    },
    {
      heading: "HOOK",
      trigger: input.productBundle,
      lines: [
        ["Offer", input.productBundle],
        ["Promo", input.promoHook],
      ],
    },
    {
      heading: "EDGE",
      trigger: input.brandDifferentiation,
      lines: [
        ["Different because", input.brandDifferentiation],
        ["Proof", input.whatCanProve],
        ["They say", input.customerVoice],
      ],
    },
    {
      // Winning goal has a default value, so trigger PLAN on the revenue goal
      // (empty on load) to honour the blank-start requirement.
      heading: "PLAN",
      trigger: input.goalAmount,
      lines: [
        ["Goal", input.winningGoal],
        ["Target", briefRupee(input.goalAmount)],
        ["Channels", briefChannels(input.channels)],
        ["Capacity", input.hoursPerWeek ? `~${input.hoursPerWeek} hrs/week` : ""],
      ],
    },
  ];

  body.innerHTML = sections
    .filter((s) => s.trigger && String(s.trigger).trim())
    .map((s) => {
      const rows = s.lines
        .filter(([, v]) => v && String(v).trim())
        .map(
          ([label, v]) =>
            `<div class="brief-line"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(v))}</strong></div>`,
        )
        .join("");
      if (!rows) return "";
      return `<div class="brief-section"><span class="brief-head">${escapeHtml(s.heading)}</span>${rows}</div>`;
    })
    .join("");
}

function updateDraftState() {
  const input = getFormInput();
  const tracker = getTrackerData();
  const showGoal = shouldDisplayGoal();
  const goal = showGoal ? numberFromCurrency(input.revenueGoal) : 0;
  const units = showGoal ? unitTarget(input.revenueGoal, input.price) : 0;
  const progress = goal ? Math.min(100, Math.round((tracker.revenue / goal) * 100)) : 0;
  const intel = computeGoalIntelligence(input);
  const primaryChannel = input.channels.includes("WhatsApp campaign")
    ? "WhatsApp"
    : input.channels[0]?.replace(" campaign", "") || "--";
  const isClosed = campaignHistory.find((c) => c.id === currentCampaignId)?.status === "closed";
  const goalLabel = showGoal && input.revenueGoal ? compactGoal(input.revenueGoal) : "--";

  document.querySelector("#topBrandName").textContent = input.brandName || "No brand selected";
  document.querySelector("#topGoalChip").textContent = showGoal && input.revenueGoal
    ? `Current Goal: ${goalLabel}`
    : "Current Goal: --";
  document.querySelector("#sideGoalValue").textContent = goalLabel;

  const tipParts = [];
  if (showGoal && input.goalChoice === "recommended" && parseNumber(input.stretchGoalAmount) !== parseNumber(input.goalAmount)) {
    tipParts.push(`Plan uses recommended ${compactGoal(input.revenueGoal)} (you entered ${compactGoal(input.stretchGoal)}).`);
  }
  if (showGoal && intel.ordersPerWeek) tipParts.push(`~${intel.ordersPerWeek} orders/week on active goal.`);
  if (input.promoHook) tipParts.push(`Promo: ${input.promoHook.slice(0, 40)}…`);
  document.querySelector("#sideGoalTip").textContent = showGoal && tipParts.length
    ? tipParts.join(" ")
    : "Complete Step 4 (goal + channels) to see your target.";

  renderOperatorBrief(input);

  document.querySelector("#dashboardGoalLabel").textContent = showGoal && units
    ? `Goal: ${units} units`
    : "Goal: complete setup";
  document.querySelector("#dashboardRevenueLabel").textContent = showGoal && input.revenueGoal
    ? `Target revenue: ${goalLabel}`
    : "Target revenue: --";
  document.querySelector("#dashboardUnits").textContent = String(units || 0);
  setRingProgress(showGoal ? progress : 0);

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
  document.querySelector("#dashStatGoal").textContent = goalLabel;
  document.querySelector("#dashStatChannel").textContent = primaryChannel;
  document.querySelector("#dashStatRevenue").textContent = `₹${tracker.revenue.toLocaleString("en-IN")}`;
  document.querySelector("#dashStatProgress").textContent = `${progress}%`;

  document.querySelector("#sideGoalBar").style.width = `${currentPlan ? Math.max(8, progress) : 0}%`;

  populateManualWeekSelect(input);
  renderCampaignWeekUI(input);
  renderCampaignHealth(input, tracker);

  if (!currentPlan) updateCampaignHeader();
  updateInsights();
  if (currentPlan) renderBriefAuditTrail(input);
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
  syncToneChipsFromInput();
  scheduleWizardDraftSave();
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
  currentPlan = null;
  document.querySelector("#briefAuditTrail")?.classList.add("hidden");
  document.querySelector("#planChangesCard")?.classList.add("hidden");
  document.querySelector("#campaignWeekChip")?.classList.add("hidden");
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
  return tags.map((t) => `<span class="asset-tag">${escapeHtml(t)}</span>`).join("");
}

function renderPlan(plan, input) {
  currentPlan = normalizePlanClient(normalizePlan(plan), input);
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
  renderBriefAuditTrail(input);
  updateDraftState();
  void loadCampaignHistory();
}

function renderExperimentDetail(exp) {
  const isWa = normalizeExperimentType(exp.type) === "whatsapp";
  const waExtra = isWa
    ? `
        <div><dt>Contact list</dt><dd>${escapeHtml(exp.contactListGuide || exp.whoToMessage || "—")}</dd></div>
        <div><dt>Exact message</dt><dd class="wa-message-block">${escapeHtml(exp.message || "—")}</dd></div>
        <div><dt>Photo to share</dt><dd>${escapeHtml(exp.photoBrief || "—")}</dd></div>
        <div><dt>Who to message</dt><dd>${escapeHtml(exp.whoToMessage || "—")}</dd></div>
        <div><dt>When to send</dt><dd>${escapeHtml(exp.sendTime || "—")}</dd></div>
        <div><dt>If they hesitate</dt><dd>${escapeHtml(exp.replyScript || "—")}</dd></div>
        ${exp.message ? `<button class="copy-btn small" data-copy-text="${escapeHtml(exp.message)}" type="button">Copy message</button>` : ""}
        ${renderWhatsappOpsBlock(exp)}
      `
    : "";

  return `
    <article class="experiment-detail">
      <div class="experiment-detail-head">
        <span class="label">${escapeHtml(exp.type || "Experiment")}</span>
        <strong>${escapeHtml(exp.title || "Untitled")}</strong>
      </div>
      <dl>
        <div><dt>Why</dt><dd>${escapeHtml(exp.why || "—")}</dd></div>
        <div><dt>Action</dt><dd>${escapeHtml(exp.action || "—")}</dd></div>
        ${waExtra}
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
  const { currentWeek, totalWeeks } = getCampaignWeekInfo(input);
  const done = countCompletedExperiments();
  const totalExp = totalExperimentsInPlan() || 1;
  const progressPct = Math.round((done / totalExp) * 100);

  commandCenter.className = "campaign-console";
  commandCenter.innerHTML = `
    <div class="glass-card campaign-progress-bar">
      <div class="campaign-progress-meta">
        <span><strong>Week ${currentWeek} of ${totalWeeks}</strong></span>
        <span class="muted">${done}/${totalExp} experiments done</span>
      </div>
      <div class="campaign-progress-track">
        <div class="campaign-progress-fill" style="width:${progressPct}%"></div>
      </div>
    </div>
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
  const taskRows = experiments
    .map((exp, expIndex) => {
      const key = experimentKey(index, expIndex);
      const done = experimentProgress[key] === true;
      const label = exp.title || exp.action || "Experiment";
      return `
        <div class="week-task-row ${done ? "done" : ""}">
          <input type="checkbox" data-exp-toggle="${escapeHtml(key)}" ${done ? "checked" : ""} aria-label="Mark experiment done" />
          <span>${escapeHtml(label)}</span>
        </div>
      `;
    })
    .join("");
  return `
    <article class="glass-card week-module">
      <span class="week-badge">${escapeHtml(week.week || `Week ${index + 1}`)}</span>
      <h5>${escapeHtml(week.theme || "Growth sprint")}</h5>
      <div class="week-tasks">${taskRows || '<p class="muted">No experiments</p>'}</div>
      <button class="week-action" type="button" data-week-index="${index}">View experiments</button>
    </article>
  `;
}

function renderContentStudio(contentAssets, input) {
  const tags = assetTags(input);
  const allowed = allowedExperimentTypes(input.channels || []);
  const reels = allowed.has("reel") ? contentAssets.reels || [] : [];
  const whatsapp = allowed.has("whatsapp") ? contentAssets.whatsapp || [] : [];
  const website = allowed.has("website") ? contentAssets.website || [] : [];
  const linkedin = allowed.has("linkedin") ? contentAssets.linkedin || [] : [];

  if (!reels.length && !whatsapp.length && !website.length && !linkedin.length) {
    contentBento.innerHTML = `<div class="glass-card empty-studio"><h3>No assets returned</h3></div>`;
    return;
  }

  contentBento.innerHTML = `
    ${tags ? `<div class="asset-tags-row">${tags}</div>` : ""}
    ${reels.length ? renderReelsCard(reels, tags) : ""}
    ${whatsapp.length ? renderWhatsappCard(whatsapp, tags) : ""}
    ${website.length ? renderWebsiteCard(website, input) : ""}
    ${linkedin.length ? renderLinkedinCard(linkedin) : ""}
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
  const packs = (messages || []).slice(0, 2);
  if (!packs.length) return "";

  return packs
    .map((pack) => {
      const text = pack.message || "";
      return `
    <div class="glass-card content-card whatsapp wa-pack-card">
      <div class="content-card-header"><h4>${escapeHtml(pack.title || "WhatsApp Broadcast")}</h4></div>
      ${tags ? `<div class="asset-tags-inline">${tags}</div>` : ""}
      <dl class="wa-pack-dl">
        <div><dt>Contact list</dt><dd>${escapeHtml(pack.contactListGuide || pack.whoToMessage || "—")}</dd></div>
        <div><dt>Who to message</dt><dd>${escapeHtml(pack.whoToMessage || "—")}</dd></div>
        <div><dt>When</dt><dd>${escapeHtml(pack.sendTime || "—")}</dd></div>
        <div><dt>Photo</dt><dd>${escapeHtml(pack.photoBrief || "—")}</dd></div>
      </dl>
      <p class="message-block">"${escapeHtml(text)}"</p>
      <p class="field-hint">If they hesitate: ${escapeHtml(pack.replyScript || "—")}</p>
      <button class="copy-btn" data-copy-text="${escapeHtml(text)}" type="button">Copy message</button>
      ${renderWhatsappOpsBlock(pack)}
    </div>
  `;
    })
    .join("");
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
  const genBtn = document.querySelector("#confirmGenerateBtn");
  const briefStatus = document.querySelector("#briefGenerateStatus");

  if (input.discoveryMode) {
    showStatus(briefStatus, "Finish Discovery Week first, or use Build plan anyway.", true);
    return;
  }

  if (input.capacityRiskLevel === "block") {
    if (
      !confirm(
        `${input.capacityNote || "This goal looks too ambitious for your time and content capacity."} Generate plan anyway?`,
      )
    ) {
      return;
    }
  }

  updateDraftState();
  switchView("campaign");
  briefPanel.classList.add("hidden");
  setButtonLoading(genBtn, true, "Generating plan…");
  commandCenter.className = "glass-card command-empty loading-state";
  commandCenter.innerHTML = `
    <span class="material-symbols-outlined empty-icon spin">sync</span>
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

    experimentProgress = {};
    renderPlan(data.plan, input);
    renderPlanChangesCard(data.priorLearnings);
    if (data.usedPriorLearnings) {
      document.querySelector("#campaignProjection").textContent = "AI Projection: informed by last closed campaign";
    }
    clearWizardDraft(input.brandName);
    switchView("campaign");
  } catch (error) {
    commandCenter.className = "glass-card command-empty error-state";
    commandCenter.innerHTML = `<h3>Generation failed</h3><p>${escapeHtml(error.message)}</p>`;
    showStatus(briefStatus, error.message, true);
  } finally {
    setButtonLoading(genBtn, false);
  }
}

async function closeCampaign() {
  const statusEl = document.querySelector("#closeCampaignStatus");
  const btn = document.querySelector("#closeCampaignBtn");
  if (!currentCampaignId) {
    showStatus(statusEl, "Generate or load a campaign first.", true);
    return;
  }
  const tracker = getTrackerData();
  const learnings = getCloseLearnings();
  showStatus(statusEl, "Saving learnings…");
  try {
    setButtonLoading(btn, true, "Saving…");
    const response = await fetch("/api/campaigns", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "close", id: currentCampaignId, tracker, learnings }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to close campaign");
    showStatus(statusEl, "Campaign closed. Next plan will use these learnings.");
    saveTrackerDraft();
    await loadCampaignHistory();
    updateDraftState();
  } catch (error) {
    showStatus(statusEl, error.message, true);
  } finally {
    setButtonLoading(btn, false);
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

async function openBriefReview() {
  const errors = validateStep(5);
  if (errors.length) return;
  await structureFailures();
  renderBriefReview();
  briefPanel.classList.remove("hidden");
}

async function handleWizardNext() {
  const errors = validateStep(currentSetupStep);
  if (errors.length) return;

  if (currentSetupStep === 5) {
    await openBriefReview();
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

  const expToggle = event.target.closest("[data-exp-toggle]");
  if (expToggle) {
    void toggleExperimentDone(expToggle.dataset.expToggle, expToggle.checked);
    return;
  }

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
document.querySelector("#coachMissionBtn")?.addEventListener("click", () => void runMissionCoach());
document.querySelector("#coachDiffBtn")?.addEventListener("click", () => void runDiffCoach());
document.querySelector("#coachOfferBtn")?.addEventListener("click", () => void runOfferCoach());
document.querySelector("#startDiscoveryBtn")?.addEventListener("click", () => void openDiscoveryWeek());
document.querySelector("#coachCloseBtn")?.addEventListener("click", () => void runCloseDebriefCoach());
document.querySelector("#useClearAudience")?.addEventListener("click", () => applyCoachClearVersion());
document.querySelector("#useFounderAudience")?.addEventListener("click", () => applyCoachFounderVersion());

document.querySelectorAll(".not-sure-toggle").forEach((btn) => {
  btn.addEventListener("click", () => toggleUnsure(btn.dataset.unsureFor));
});

document.querySelectorAll(".tone-chip").forEach((chip) => {
  chip.addEventListener("click", () => toggleToneChip(chip));
});

document.querySelector("#showDiscoveryReturn")?.addEventListener("click", () => {
  document.querySelector("#discoveryReturn").classList.remove("hidden");
  scheduleWizardDraftSave();
  updateDiscoveryMinBar();
});
document.querySelector("#synthesizeDiscoveryBtn")?.addEventListener("click", () => void synthesizeDiscovery());
document.querySelector("#forcePlanBtn")?.addEventListener("click", () => {
  discoveryOverride = true;
  discoveryMode = false;
  discoveryPanel.classList.add("hidden");
  scheduleWizardDraftSave();
  alert("OK — we'll build a plan, but it may be less accurate without customer data.");
});

["#whoFound", "#areasFound", "#substituteFound", "#hesitationFound"].forEach((sel) => {
  document.querySelector(sel)?.addEventListener("input", () => {
    scheduleWizardDraftSave();
    updateDiscoveryMinBar();
  });
  document.querySelector(sel)?.addEventListener("change", () => {
    scheduleWizardDraftSave();
    updateDiscoveryMinBar();
  });
});

generatorForm.querySelectorAll('input[name="campaignScope"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    syncRevenueScopeLabels();
    updateDraftState();
    scheduleWizardDraftSave();
  });
});

document.addEventListener("click", (event) => {
  if (event.target?.id === "applyDeliverySuggest") {
    const where = generatorForm.elements.namedItem("whereLive")?.value?.trim();
    const delivery = generatorForm.elements.namedItem("deliveryArea");
    if (where && delivery) {
      delivery.value = where;
      syncDeliveryAreaHint();
      scheduleWizardDraftSave();
      updateDraftState();
    }
  }
});

document.querySelector("#structureFailuresBtn")?.addEventListener("click", () => void structureFailures());
document.querySelector("#openBriefBtn")?.addEventListener("click", () => void openBriefReview());
document.querySelector("#confirmGenerateBtn")?.addEventListener("click", () => void generatePlan());

document.querySelector("#optimizeBtn")?.addEventListener("click", () => {
  switchView(currentPlan ? "tracker" : "setup");
});
document.querySelector("#syncMetrics")?.addEventListener("click", async () => {
  saveTrackerDraft();
  const status = document.querySelector("#trackerSaveStatus");
  if (status) showStatus(status, "Saving…");
  const result = await saveCampaignProgressToServer();
  if (status) {
    showStatus(
      status,
      result.saved ? "Progress saved to campaign." : result.error || "Saved on this device only.",
      !result.saved,
    );
  }
  updateDraftState();
});
document.querySelector("#manualWeek")?.addEventListener("change", () => {
  scheduleTrackerSave();
  if (currentPlan) {
    const input = getFormInput();
    renderCommandCenter(currentPlan, input);
    renderCampaignWeekUI(input);
  }
  void saveCampaignProgressToServer();
});
document.querySelector("#closeCampaignBtn")?.addEventListener("click", () => void closeCampaign());
document.querySelector("#refreshHistory")?.addEventListener("click", () => void loadCampaignHistory());

sidebarNav?.addEventListener("click", (event) => {
  const link = event.target.closest(".nav-link[data-view]");
  if (link) switchView(link.dataset.view);
});

loadSample?.addEventListener("click", fillSample);
generatorForm.addEventListener("input", () => {
  if (!currentCampaignId) {
    currentPlan = null;
    renderEmptyPlan();
  }
  if (currentSetupStep === 4) {
    renderGoalIntelligence();
    syncDeliveryAreaHint();
  }
  updateDraftState();
  scheduleWizardDraftSave();
});
document.querySelector("#categorySelect")?.addEventListener("change", () => {
  syncCategorySelect();
  updateDraftState();
  scheduleWizardDraftSave();
});
generatorForm.querySelectorAll('input[name="goalChoice"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    if (currentSetupStep === 4) renderGoalIntelligence();
    updateDraftState();
    scheduleWizardDraftSave();
  });
});
generatorForm.addEventListener("submit", (e) => e.preventDefault());
trackerForm.addEventListener("input", () => {
  updateDraftState();
  updateInsights();
  scheduleTrackerSave();
});

renderEmptyPlan();
syncCategorySelect();
syncToneChipsFromInput();
if (!maybeResumeWizardDraft()) {
  showSetupStep(1);
  applyTrackerDraft(null);
}
syncRevenueScopeLabels();
updateDraftState();
setRingProgress(0);
void loadCampaignHistory();

/* ===================================================================
   Access gate — 6-digit PIN + one-time brand onboarding.
   Runs after the app has booted; both overlays are position:fixed and
   cover the app until the user is unlocked / onboarded.
   =================================================================== */
(function initAccessGate() {
  const UNLOCK_KEY = "superattention_unlocked";
  const pinGate = document.querySelector("#pinGate");
  const pinBoxes = document.querySelector("#pinBoxes");
  const pinInputs = pinGate ? [...pinGate.querySelectorAll(".pin-digit")] : [];
  const pinError = document.querySelector("#pinError");
  const onboarding = document.querySelector("#brandOnboarding");

  if (!pinGate) return;

  // Brand context resolved during the onboarding fetch (needed for AI assist
  // + the upsert). Falls back to the default brand when the table is empty.
  let obBrandName = sampleBrand.brandName;
  let obCategory = sampleBrand.category;

  /* ---------- PIN ---------- */
  function focusFirstPin() {
    pinInputs[0]?.focus();
  }

  function clearPin() {
    pinInputs.forEach((el) => {
      el.value = "";
      el.classList.remove("error");
    });
  }

  function showPinError() {
    pinError?.classList.remove("hidden");
    pinInputs.forEach((el) => el.classList.add("error"));
    pinBoxes.classList.add("shake");
    setTimeout(() => {
      pinBoxes.classList.remove("shake");
      clearPin();
      focusFirstPin();
    }, 420);
  }

  async function submitPin() {
    const pin = pinInputs.map((el) => el.value).join("");
    if (pin.length !== pinInputs.length) return;

    pinInputs.forEach((el) => (el.disabled = true));
    try {
      const res = await fetch("/api/verify-pin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => ({}));
      pinInputs.forEach((el) => (el.disabled = false));

      if (res.ok && data.ok) {
        sessionStorage.setItem(UNLOCK_KEY, "true");
        pinGate.classList.add("hidden");
        void runOnboardingGate();
      } else {
        showPinError();
      }
    } catch {
      pinInputs.forEach((el) => (el.disabled = false));
      showPinError();
    }
  }

  function wirePinInputs() {
    pinInputs.forEach((input, idx) => {
      input.addEventListener("input", () => {
        input.value = input.value.replace(/\D/g, "").slice(-1);
        pinError?.classList.add("hidden");
        input.classList.remove("error");
        if (input.value && idx < pinInputs.length - 1) {
          pinInputs[idx + 1].focus();
        }
        if (pinInputs.every((el) => el.value)) void submitPin();
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !input.value && idx > 0) {
          pinInputs[idx - 1].focus();
        }
      });
    });
    pinBoxes.addEventListener("paste", (e) => {
      const digits = (e.clipboardData?.getData("text") || "").replace(/\D/g, "");
      if (!digits) return;
      e.preventDefault();
      pinInputs.forEach((el, i) => (el.value = digits[i] || ""));
      const next = Math.min(digits.length, pinInputs.length - 1);
      pinInputs[next].focus();
      if (pinInputs.every((el) => el.value)) void submitPin();
    });
  }

  /* ---------- Brand onboarding ---------- */
  const PRESET_TONES = [
    "homemade", "nostalgic", "playful", "trustworthy",
    "traditional", "authentic", "premium",
  ];
  const MAX_CUSTOM_CHIPS = 3;

  function helperForCategory(category) {
    const c = String(category || "").toLowerCase();
    if (/(pickle|snack|namkeen|spice|masala|sweet|mithai|food|beverage|drink)/.test(c))
      return "e.g. Sunday lunch, tiffin time, guest visits";
    if (/(health|wellness)/.test(c))
      return "e.g. morning routine, post-workout, feeling low";
    if (/(beauty|skincare|skin)/.test(c))
      return "e.g. getting ready, self-care Sunday, big day prep";
    if (/(fashion|accessor|apparel|cloth)/.test(c))
      return "e.g. first impression moment, date night, festival dressing";
    if (/(home|kitchen|lifestyle)/.test(c))
      return "e.g. hosting guests, winding down, gifting someone";
    return "e.g. the moment it makes life easier";
  }

  function selectedTones() {
    return [...onboarding.querySelectorAll(".ob-chip.selected")].map((c) =>
      c.dataset.value || c.textContent.trim(),
    );
  }

  function countCustomChips() {
    return onboarding.querySelectorAll(".ob-chip[data-custom='true']").length;
  }

  function makeChip(label, { custom = false, selected = false } = {}) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "ob-chip" + (selected ? " selected" : "");
    chip.textContent = label;
    chip.dataset.value = label;
    if (custom) chip.dataset.custom = "true";
    chip.addEventListener("click", () => chip.classList.toggle("selected"));
    return chip;
  }

  function renderChips() {
    const wrap = document.querySelector("#obChips");
    wrap.innerHTML = "";
    PRESET_TONES.forEach((t) => wrap.appendChild(makeChip(t)));

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "ob-chip ob-chip-add";
    addBtn.textContent = "+";
    addBtn.addEventListener("click", () => {
      if (countCustomChips() >= MAX_CUSTOM_CHIPS) return;
      const input = document.createElement("input");
      input.type = "text";
      input.className = "ob-chip-input";
      input.placeholder = "your word";
      const commit = () => {
        const word = input.value.trim();
        if (word) {
          wrap.insertBefore(makeChip(word, { custom: true, selected: true }), addBtn);
        }
        input.remove();
        if (countCustomChips() < MAX_CUSTOM_CHIPS) addBtn.classList.remove("hidden");
      };
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); commit(); }
        if (e.key === "Escape") input.remove();
      });
      input.addEventListener("blur", commit);
      wrap.insertBefore(input, addBtn);
      input.focus();
    });
    wrap.appendChild(addBtn);
  }

  async function runAssist(field, button) {
    const targets = { 1: "#obWhyStarted", 2: "#obMission", 3: "#obDayBetter", 4: "#obFeeling" };
    const target = document.querySelector(targets[field]);
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Writing…";
    try {
      const res = await fetch("/api/brand-assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          field: String(field),
          notes: document.querySelector("#obWhyStarted").value.trim(),
          brandName: obBrandName,
          category: obCategory,
          whyStarted: document.querySelector("#obWhyStarted").value.trim(),
          mission: document.querySelector("#obMission").value.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.text) {
        target.value = data.text;
        target.closest(".ob-field")?.classList.remove("ob-invalid");
      }
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  function validateOnboarding() {
    const map = {
      whyStarted: document.querySelector("#obWhyStarted").value.trim(),
      mission: document.querySelector("#obMission").value.trim(),
      dayBetter: document.querySelector("#obDayBetter").value.trim(),
      feeling: document.querySelector("#obFeeling").value.trim(),
    };
    let ok = true;
    Object.entries(map).forEach(([key, val]) => {
      const field = onboarding.querySelector(`[data-ob-field="${key}"]`);
      const bad = !val;
      field?.classList.toggle("ob-invalid", bad);
      if (bad) ok = false;
    });
    const tones = selectedTones();
    const toneField = onboarding.querySelector('[data-ob-field="tone"]');
    const toneBad = tones.length < 2;
    toneField?.classList.toggle("ob-invalid", toneBad);
    if (toneBad) ok = false;
    return { ok, map, tones };
  }

  async function submitOnboarding(button) {
    const { ok, map, tones } = validateOnboarding();
    const obError = document.querySelector("#obError");
    if (!ok) {
      obError.textContent = "Fill in all fields to continue";
      obError.classList.remove("hidden");
      return;
    }
    obError.classList.add("hidden");
    button.disabled = true;
    const label = button.textContent;
    button.textContent = "Saving…";
    try {
      const res = await fetch("/api/brand", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: obBrandName,
          why_started: map.whyStarted,
          mission: map.mission,
          day_better_moment: map.dayBetter,
          customer_feeling: map.feeling,
          brand_tone: tones.join(", "),
          brand_stage: document.querySelector("#obStage").value,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.saved) {
        onboarding.classList.add("hidden");
        switchView("setup");
        showSetupStep(1);
      } else {
        obError.textContent = data.error || "Could not save. Please try again.";
        obError.classList.remove("hidden");
        button.disabled = false;
        button.textContent = label;
      }
    } catch {
      obError.textContent = "Could not save. Please try again.";
      obError.classList.remove("hidden");
      button.disabled = false;
      button.textContent = label;
    }
  }

  function showOnboarding() {
    document.querySelector("#obDayBetterHelper").textContent = helperForCategory(obCategory);
    renderChips();
    onboarding.querySelectorAll(".ob-assist").forEach((btn) => {
      btn.addEventListener("click", () => void runAssist(Number(btn.dataset.assist), btn));
    });
    document.querySelector("#obSubmit").addEventListener("click", (e) =>
      void submitOnboarding(e.currentTarget),
    );
    onboarding.classList.remove("hidden");
    document.querySelector("#obWhyStarted").focus();
  }

  async function runOnboardingGate() {
    try {
      const res = await fetch("/api/brand");
      const data = await res.json().catch(() => ({}));
      const brand = data.brand || null;
      if (brand?.name) obBrandName = brand.name;
      if (brand?.category) obCategory = brand.category;

      const done = brand && brand.why_started && String(brand.why_started).trim();
      if (done) {
        onboarding.classList.add("hidden"); // already onboarded → straight to app
      } else {
        showOnboarding();
      }
    } catch {
      // Fail open: a transient brand-fetch error shouldn't lock the user out.
      onboarding.classList.add("hidden");
    }
  }

  /* ---------- Boot the gate ---------- */
  if (sessionStorage.getItem(UNLOCK_KEY) === "true") {
    pinGate.classList.add("hidden");
    void runOnboardingGate();
  } else {
    wirePinInputs();
    focusFirstPin();
  }
})();

/* ===================================================================
   Wizard v2 wiring — Product / Buyer / Hook / Edge / Plan.
   =================================================================== */

// --- Buyer gate ---
function updateBuyerGateQuestion() {
  const el = document.querySelector("#buyerGateQuestion");
  if (!el) return;
  let product = generatorForm.elements.namedItem("product")?.value?.trim() || "";
  if (!product) product = "your product";
  else if (product.length > 30) product = product.slice(0, 30) + "…";
  el.textContent = `Have you talked to someone who actually bought ${product}?`;
}

function revealStep2Fields() {
  document.querySelector("#buyerGate")?.classList.add("hidden");
  document.querySelector("#step2Fields")?.classList.remove("hidden");
  document.querySelector("#discoveryRestartLink")?.classList.remove("hidden");
}

function applyDiscoveryToBuyerFields(result, findings) {
  const f = findings || {};
  const set = (name, value, flag) => {
    const el = generatorForm.elements.namedItem(name);
    if (el && value) el.value = value;
    if (value) {
      const label = document.querySelector(`.from-discovery[data-discovery-for="${flag || name}"]`);
      label?.classList.remove("hidden");
    }
  };
  set("whoBuys", f.whoFound || f.whoBuys);
  set("whereLive", f.areasFound || f.whereLive);
  set("substitute", f.substituteFound || f.substitute);
  const hes = generatorForm.elements.namedItem("hesitation");
  if (hes && (result?.hesitationLabel || f.hesitationFound)) {
    document.querySelector('.from-discovery[data-discovery-for="hesitation"]')?.classList.remove("hidden");
  }
}

// --- Plan conditional fields ---
function selectedChannelValues() {
  return [...generatorForm.querySelectorAll('input[name="channels"]:checked')].map((c) => c.value.toLowerCase());
}

function syncPlanConditionals() {
  const chans = selectedChannelValues();
  const wa = chans.some((c) => c.includes("whatsapp"));
  const ig = chans.some((c) => c.includes("reel") || c.includes("instagram"));
  document.querySelector("#waFields")?.classList.toggle("visible", wa);
  document.querySelector("#igFields")?.classList.toggle("visible", ig);
  const hasList = generatorForm.elements.namedItem("hasBroadcastList")?.value || "";
  document.querySelector("#broadcastSizeBlock")?.classList.toggle("hidden", hasList !== "no");
}

function syncCrossChannelWarnings() {
  const el = document.querySelector("#crossChannelWarning");
  if (!el) return;
  const goal = (generatorForm.elements.namedItem("winningGoal")?.value || "").toLowerCase();
  const waSelected = selectedChannelValues().some((c) => c.includes("whatsapp"));
  let msg = "";
  if (!waSelected && goal.includes("repeat")) {
    msg = "Repeat buyers are best reached on WhatsApp — consider adding it";
  } else if (!waSelected && goal.includes("list")) {
    msg = "Building a list works best on WhatsApp — consider adding it";
  }
  el.textContent = msg;
  el.classList.toggle("hidden", !msg);
}

// --- Two-button toggle groups (hasBroadcastList, instagramStories) ---
function setToggleGroup(group, value) {
  const wrap = document.querySelector(`[data-toggle-group="${group}"]`);
  const hidden = generatorForm.elements.namedItem(group);
  if (!wrap || !hidden) return;
  hidden.value = value;
  wrap.querySelectorAll(".toggle-btn").forEach((b) => b.classList.toggle("selected", b.dataset.value === value));
}

// --- Brand identity hidden inputs (sourced from onboarding / brands table) ---
async function fillHiddenBrandIdentity() {
  try {
    const res = await fetch("/api/brand");
    const data = await res.json().catch(() => ({}));
    const b = data.brand;
    if (!b) return;
    const set = (name, val) => {
      const el = generatorForm.elements.namedItem(name);
      if (el && val) el.value = val;
    };
    set("brandMission", b.mission);
    set("brandTone", b.brand_tone);
    set("brandStage", b.brand_stage);
    if (b.name) {
      const bn = generatorForm.elements.namedItem("brandName");
      if (bn && !bn.value.trim()) bn.value = b.name;
    }
    if (b.category) {
      const cat = document.querySelector("#categorySelect");
      if (cat && !cat.value) cat.value = b.category;
    }
  } catch {
    /* non-fatal */
  }
}

// --- Prefill order channel + delivery area from the last campaign ---
async function prefillFromLastCampaign() {
  try {
    const res = await fetch("/api/campaigns");
    const data = await res.json().catch(() => ({}));
    const last = Array.isArray(data.campaigns) ? data.campaigns[0] : null;
    if (!last) return;
    const p = last.input_payload || {};
    const oc = generatorForm.elements.namedItem("orderChannel");
    const da = generatorForm.elements.namedItem("deliveryArea");
    if (oc && p.orderChannel) oc.value = p.orderChannel;
    if (da && !da.value.trim() && (p.deliveryArea || last.delivery_area)) {
      da.value = p.deliveryArea || last.delivery_area;
    }
  } catch {
    /* non-fatal */
  }
}

// --- Reset Step 1 ---
function resetStep1() {
  const step = generatorForm.querySelector('[data-setup-step="1"]');
  if (!step) return;
  step.querySelectorAll("input, select").forEach((el) => {
    if (el.name === "campaignScope") return; // keep hidden scope default
    if (el.tagName === "SELECT") el.selectedIndex = 0;
    else el.value = "";
  });
  updateDraftState();
  scheduleWizardDraftSave();
}

/* ---------- Attach listeners ---------- */
document.querySelector("#resetStep1")?.addEventListener("click", resetStep1);

document.querySelector("#buyerGateYes")?.addEventListener("click", () => {
  discoveryMode = false;
  revealStep2Fields();
});
document.querySelector("#buyerGateNo")?.addEventListener("click", () => {
  void openDiscoveryWeek();
});
document.querySelector("#discoveryRestartLink")?.addEventListener("click", () => {
  document.querySelector("#step2Fields")?.classList.add("hidden");
  void openDiscoveryWeek();
});

generatorForm.elements.namedItem("product")?.addEventListener("input", updateBuyerGateQuestion);

document.querySelectorAll('[data-toggle-group] .toggle-btn').forEach((btn) => {
  btn.addEventListener("click", () => {
    const group = btn.closest("[data-toggle-group]").dataset.toggleGroup;
    setToggleGroup(group, btn.dataset.value);
    syncPlanConditionals();
    scheduleWizardDraftSave();
    updateDraftState();
  });
});

generatorForm.querySelectorAll('input[name="channels"]').forEach((cb) => {
  cb.addEventListener("change", () => {
    syncPlanConditionals();
    syncCrossChannelWarnings();
    updateDraftState();
    scheduleWizardDraftSave();
  });
});
document.querySelector("#winningGoal")?.addEventListener("change", () => {
  syncCrossChannelWarnings();
  updateDraftState();
});

// Promo soft warning (non-blocking) when leaving Hook step empty.
document.querySelector("#wizardNext")?.addEventListener("click", () => {
  if (currentSetupStep === 3) {
    const promo = generatorForm.elements.namedItem("promoHook")?.value?.trim();
    document.querySelector("#promoSoftWarning")?.classList.toggle("hidden", Boolean(promo));
  }
});

// Edge — differentiation AI assist.
document.querySelector("#edgeDiffBtn")?.addEventListener("click", async () => {
  const btn = document.querySelector("#edgeDiffBtn");
  const status = document.querySelector("#edgeDiffStatus");
  const target = generatorForm.elements.namedItem("brandDifferentiation");
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Writing…";
  try {
    const res = await fetch("/api/edge-assist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        product: generatorForm.elements.namedItem("product")?.value?.trim() || "",
        whatCanProve: generatorForm.elements.namedItem("whatCanProve")?.value?.trim() || "",
        competitorsCantCopy: generatorForm.elements.namedItem("competitorsCantCopy")?.value?.trim() || "",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.text) {
      target.value = data.text;
      if (status) showStatus(status, "");
    } else if (status) {
      showStatus(status, data.error || "Could not generate. Try again.", true);
    }
  } catch {
    if (status) showStatus(status, "Could not generate. Try again.", true);
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
});

// Boot v2 wiring.
updateBuyerGateQuestion();
syncPlanConditionals();
void fillHiddenBrandIdentity();
void prefillFromLastCampaign();

/* ===================================================================
   Session 4 — landing states, cards grid, campaign detail routing.
   =================================================================== */
function monthYearOf(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", { month: "long", year: "numeric" });
}

function campaignName(row) {
  return `${row.product || "Campaign"} — ${monthYearOf(row.created_at)}`;
}

function cardStatus(row) {
  return row.plan_text
    ? { label: "LIVE", cls: "badge-live" }
    : { label: "DRAFT", cls: "badge-draft" };
}

function earnedLabel(row) {
  const raw = row.metrics?.tracker?.revenue;
  const digits = String(raw || "").replace(/[^0-9]/g, "");
  const n = digits ? Number(digits) : 0;
  return `₹${n.toLocaleString("en-IN")} earned`;
}

function renderCampaignCards(campaigns) {
  const grid = document.querySelector("#campaignCardsGrid");
  if (!grid) return;
  const sorted = [...campaigns].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at),
  );
  grid.innerHTML = sorted
    .map((row) => {
      const st = cardStatus(row);
      return `
        <article class="campaign-grid-card glass-card" data-open-campaign="${escapeHtml(row.id)}" role="button" tabindex="0">
          <div class="cgc-head">
            <h3>${escapeHtml(campaignName(row))}</h3>
            <span class="cgc-badge ${st.cls}">${st.label}</span>
          </div>
          <p class="cgc-sku">${escapeHtml(row.product || "")}</p>
          <div class="cgc-meta">
            <span>Goal: ${escapeHtml(row.goal || "—")}</span>
            <span>${escapeHtml(earnedLabel(row))}</span>
          </div>
        </article>`;
    })
    .join("");
}

function lockSidebar(locked) {
  document.querySelectorAll('#sidebarNav .nav-link[data-view]').forEach((link) => {
    if (link.dataset.view === "dashboard") return;
    link.classList.toggle("locked", locked);
    if (locked) link.setAttribute("title", "Complete your first campaign to unlock");
    else link.removeAttribute("title");
  });
}

async function loadDashboard() {
  const grid = document.querySelector("#campaignCardsGrid");
  const promptB = document.querySelector("#stateBPrompt");
  const newBtn = document.querySelector("#newCampaignBtn");
  try {
    const res = await fetch("/api/campaigns");
    const data = await res.json().catch(() => ({}));
    campaignHistory = data.campaigns || [];
  } catch {
    campaignHistory = [];
  }

  if (campaignHistory.length) {
    // State C — campaigns exist.
    promptB?.classList.add("hidden");
    grid?.classList.remove("hidden");
    renderCampaignCards(campaignHistory);
    newBtn?.classList.remove("hidden");
    lockSidebar(false);
  } else {
    // State B — brand exists, no campaigns.
    grid?.classList.add("hidden");
    promptB?.classList.remove("hidden");
    newBtn?.classList.add("hidden");
    lockSidebar(true);
  }
}

function renderDetailHeader(row) {
  const nameEl = document.querySelector("#detailCampaignName");
  if (nameEl) nameEl.textContent = campaignName(row);
  const badge = document.querySelector("#detailStatusBadge");
  if (badge) {
    const st = cardStatus(row);
    badge.textContent = st.label;
    badge.className = `detail-status-badge ${st.cls}`;
  }
}

async function openCampaignDetail(id) {
  if (!campaignHistory.find((c) => c.id === id)) {
    try {
      const res = await fetch("/api/campaigns");
      const data = await res.json().catch(() => ({}));
      campaignHistory = data.campaigns || [];
    } catch {
      /* ignore */
    }
  }
  const row = campaignHistory.find((c) => c.id === id);
  if (!row) {
    goToDashboard();
    return;
  }
  loadCampaignFromHistory(id, { detail: true });
}

function goToDashboard() {
  if (location.pathname !== "/") history.pushState({}, "", "/");
  switchView("dashboard");
  void loadDashboard();
}

function handleRoute() {
  const m = location.pathname.match(/^\/campaign\/([^/]+)$/);
  if (m) {
    void openCampaignDetail(decodeURIComponent(m[1]));
  } else {
    switchView("dashboard");
    void loadDashboard();
  }
}

function startNewCampaign() {
  showSetupStep(1);
  switchView("setup");
}

// Listeners
document.querySelector("#newCampaignBtn")?.addEventListener("click", startNewCampaign);
document.querySelector("#buildFirstCampaignBtn")?.addEventListener("click", startNewCampaign);
document.querySelector("#detailBackBtn")?.addEventListener("click", goToDashboard);
document.querySelector("#campaignLearningsBtn")?.addEventListener("click", () => {
  document.querySelector("#learningsTooltip")?.classList.toggle("hidden");
});
document.querySelector("#campaignCardsGrid")?.addEventListener("click", (e) => {
  const card = e.target.closest("[data-open-campaign]");
  if (card) void openCampaignDetail(card.dataset.openCampaign);
});
// Refresh dashboard state whenever the Dashboard nav item is used.
document.querySelector('#sidebarNav .nav-link[data-view="dashboard"]')?.addEventListener("click", () => {
  void loadDashboard();
});
// Block locked sidebar items (State B).
document.querySelector("#sidebarNav")?.addEventListener(
  "click",
  (e) => {
    const link = e.target.closest(".nav-link[data-view]");
    if (link && link.classList.contains("locked")) {
      e.preventDefault();
      e.stopPropagation();
    }
  },
  true,
);
window.addEventListener("popstate", handleRoute);

// Initial route (dashboard state B/C or deep-linked campaign detail).
handleRoute();
