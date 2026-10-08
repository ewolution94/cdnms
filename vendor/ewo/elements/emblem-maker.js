import { EwoElement as e, css as t, define as n, onPageLanguage as r, pageLanguage as i, reducedMotion as a } from "./base.js";
import { emblemNames as o, emblemRanges as s, emblemTheme as c, isEmblem as l, parseEmblem as u, randomEmblem as d } from "./emblem-core.js";
import "./emblem.js";
//#region packages/elements/src/emblem-maker.ts
var f = {
	de: {
		roll: "Würfeln",
		rolled: "Gewürfelt",
		prev: "{part}: vorherige",
		next: "{part}: nächste",
		parts: "Teile"
	},
	en: {
		roll: "Roll",
		rolled: "Rolled",
		prev: "{part}: previous",
		next: "{part}: next",
		parts: "Parts"
	}
}, p = t`
  /* The strip naming a change sits on the stage's top edge and rises above it. Its room is the
     maker's own padding, so a scrolling parent can't clip it: inside an ewo-sheet the body's
     overflow cut it off under the header (2026-10-08). */
  :host {
    display: grid;
    justify-items: center;
    gap: var(--ewo-space-3);
    padding-top: 20px;
    --_stage: var(--ewo-emblem-maker-size, 200px);
    /* The whole maker is a no-zoom area, not only its buttons: a pressed arrow shrinks for a moment,
       and four quick taps then landed in the gaps around it, which zoomed the page on the iPhone
       (2026-10-08). Panning and pinch zoom still work. */
    touch-action: manipulation;
  }
  .maker {
    display: grid;
    grid-template-columns: 44px minmax(0, var(--_stage)) 44px;
    justify-content: center;
    gap: 10px;
    width: 100%;
  }
  .col {
    display: grid;
    grid-auto-rows: 1fr;
    gap: 4px;
  }
  .arrow {
    display: grid;
    place-items: center;
    min-height: 36px;
    border: 1.5px solid var(--ewo-line-strong);
    border-radius: var(--ewo-r-md);
    background: var(--ewo-bg-raised);
    color: var(--ewo-fg);
    transition: transform 80ms, background var(--ewo-dur-1) var(--ewo-ease);
  }
  @media (hover: hover) {
    .arrow:hover { background: var(--ewo-fill-2); }
  }
  /* Pressed: from pointerdown, held at least a moment, because iOS shows :active on no quick tap. */
  .arrow:active, .arrow.pressed { transform: scale(0.9); background: var(--ewo-fill-2); }
  .arrow, .dice { -webkit-tap-highlight-color: transparent; transition: transform 90ms var(--ewo-ease), background var(--ewo-dur-1) var(--ewo-ease); }
  .dice:active, .dice.pressed { transform: scale(0.95); background: var(--ewo-fill-2); }
  .arrow svg, .dice svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
  .stage {
    position: relative;
    aspect-ratio: 1;
    border-radius: var(--ewo-r-lg);
    background: var(--ewo-fill);
  }
  .stage ewo-emblem {
    position: absolute;
    inset: var(--ewo-emblem-maker-inset, 8%);
    width: auto;
    height: auto;
  }
  .hop { animation: hop 0.5s ease-out; }
  @keyframes hop {
    35% { transform: translateY(-10px) rotate(-3deg); }
    70% { transform: translateY(0) rotate(1deg); }
  }
  .tag {
    position: absolute;
    left: 50%;
    top: -12px;
    z-index: 1;
    padding: 3px 10px;
    border-radius: var(--ewo-r-sm);
    background: var(--ewo-accent);
    color: var(--ewo-accent-ink);
    font: 600 var(--ewo-text-xs) / 1.3 var(--ewo-sans);
    white-space: nowrap;
    transform: translateX(-50%) rotate(-3deg);
    opacity: 0;
    transition: opacity 0.25s;
    pointer-events: none;
  }
  .tag.on { opacity: 1; transition: none; }
  .legend {
    margin: 0;
    color: var(--ewo-fg-3);
    font-size: var(--ewo-text-xs);
    text-align: center;
  }
  .dice {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 16px;
    border: 1.5px solid var(--ewo-line-strong);
    border-radius: var(--ewo-r-pill);
    background: var(--ewo-bg-raised);
    font-weight: 600;
  }
  .dice svg { stroke-width: 2; width: 20px; height: 20px; }
  .dice svg circle { fill: currentColor; stroke: none; }
  .rolling svg { animation: roll 0.45s ease-out; }
  @keyframes roll { to { transform: rotate(360deg); } }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

  /* layout="tabs": one tall pair of arrows, a strip naming the choice, a tab per part. */
  /* A row, not the grid: the stage takes its size and gives way on a narrow screen (WebKit leaves a
     min() with a percentage unresolved as a grid track, and the stage, whose emblem is absolutely
     placed, then collapsed to nothing). */
  .maker.tabs { display: flex; align-items: center; justify-content: center; }
  .maker.tabs .arrow { flex: none; width: 48px; min-height: 72px; }
  .maker.tabs .stage { flex: 0 1 var(--_stage); min-width: 0; }
  .maker.tabs .stage { touch-action: pan-y; user-select: none; -webkit-user-select: none; }
  .strip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 4px 10px;
    margin: 0;
    font: 600 var(--ewo-text-sm) / 1.3 var(--ewo-sans);
  }
  .strip .part { color: var(--ewo-fg-3); font-weight: 500; }
  .dots { display: inline-flex; gap: 4px; }
  .dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--ewo-line-strong); }
  .dots i.on { background: var(--ewo-fg); }
  .tabs { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
  .tab {
    min-height: 36px;
    padding: 0 12px;
    border: 1.5px solid var(--ewo-line-strong);
    border-radius: var(--ewo-r-md);
    background: var(--ewo-bg-raised);
    color: var(--ewo-fg);
    font: 600 var(--ewo-text-sm) / 1 var(--ewo-sans);
    -webkit-tap-highlight-color: transparent;
  }
  .tab[aria-pressed='true'] { border-color: var(--ewo-fg); background: var(--ewo-fg); color: var(--ewo-bg); }
  @media (prefers-reduced-motion: reduce) {
    .hop, .rolling svg { animation: none; }
    /* Still a visible press, without the movement. */
    .arrow.pressed, .arrow:active, .dice.pressed, .dice:active { transform: none; }
  }
`, m = (e) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${e}"/></svg>`, h = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"3.5\"/><circle cx=\"9\" cy=\"9\" r=\"1.2\"/><circle cx=\"15\" cy=\"15\" r=\"1.2\"/><circle cx=\"15\" cy=\"9\" r=\"1.2\"/><circle cx=\"9\" cy=\"15\" r=\"1.2\"/><circle cx=\"12\" cy=\"12\" r=\"1.2\"/></svg>", g = class extends e {
	static styles = [p];
	static observedAttributes = [
		"theme",
		"value",
		"initial",
		"layout"
	];
	#e;
	#t = 0;
	#n = 0;
	connectedCallback() {
		l(this.theme, u(this.getAttribute("value"))) || this.setAttribute("value", d(this.theme).join(",")), this.#e = r(() => this.#a()), this.#a();
	}
	disconnectedCallback() {
		this.#e?.();
	}
	attributeChangedCallback(e) {
		if (this.isConnected) {
			if (e === "theme" && !l(this.theme, u(this.getAttribute("value")))) {
				this.setAttribute("value", d(this.theme).join(","));
				return;
			}
			e === "value" && this.root.querySelector("ewo-emblem") ? (this.#r().value = this.value, this.#s()) : e === "initial" && this.root.querySelector("ewo-emblem") ? this.#r().setAttribute("initial", this.getAttribute("initial") ?? "") : this.#a();
		}
	}
	get theme() {
		return c(this.getAttribute("theme")).id;
	}
	set theme(e) {
		this.setAttribute("theme", e);
	}
	get value() {
		let e = u(this.getAttribute("value"));
		return e && l(this.theme, e) ? e : s(this.theme).map(() => 0);
	}
	set value(e) {
		this.setAttribute("value", Array.isArray(e) ? e.join(",") : String(e));
	}
	#r() {
		return this.root.querySelector("ewo-emblem");
	}
	get #i() {
		return this.getAttribute("layout") === "tabs";
	}
	#a() {
		if (this.#i) return this.#o();
		let e = i(), t = f[e], n = o(this.theme, e), r = (e, r) => n.map((n, i) => `<button class="arrow" part="arrow ${e}" type="button" data-press="own" data-part="${i}" data-step="${e === "prev" ? -1 : 1}" aria-label="${t[e].replace("{part}", n.name)}">${m(r)}</button>`).join("");
		this.root.innerHTML = `<div class="maker"><div class="col">${r("prev", "M15 5l-7 7 7 7")}</div><div class="stage" part="stage"><ewo-emblem theme="${this.theme}" value="${this.value.join(",")}" boil></ewo-emblem><span class="tag" part="tag" aria-hidden="true"></span></div><div class="col">${r("next", "M9 5l7 7-7 7")}</div></div><p class="legend" part="legend">${n.map((e) => e.name).join(" · ")}</p><button class="dice" part="dice" type="button" data-press="own">${h}<span>${t.roll}</span></button><p class="sr" aria-live="polite"></p>`, this.#r().setAttribute("initial", this.getAttribute("initial") ?? "");
		for (let e of this.root.querySelectorAll(".arrow")) e.addEventListener("click", () => this.#l(Number(e.dataset.part), Number(e.dataset.step)));
		this.root.querySelector(".dice").addEventListener("click", () => this.#u());
		for (let e of this.root.querySelectorAll(".arrow, .dice")) this.#d(e);
	}
	#o() {
		let e = i(), t = f[e], n = o(this.theme, e);
		this.#n = Math.min(this.#n, n.length - 1);
		let r = (e, t) => `<button class="arrow" part="arrow ${e}" type="button" data-press="own" data-step="${e === "prev" ? -1 : 1}">${m(t)}</button>`;
		this.root.innerHTML = `<div class="maker tabs">${r("prev", "M15 5l-7 7 7 7")}<div class="stage" part="stage"><ewo-emblem theme="${this.theme}" value="${this.value.join(",")}" boil></ewo-emblem></div>${r("next", "M9 5l7 7-7 7")}</div><p class="strip" part="strip" aria-hidden="true"></p><div class="tabs" part="tabs" role="group" aria-label="${t.parts}">` + n.map((e, t) => `<button class="tab" part="tab${t === this.#n ? " chosen" : ""}" type="button" data-press="own" data-part="${t}" aria-pressed="${t === this.#n}">${e.name}</button>`).join("") + `</div><button class="dice" part="dice" type="button" data-press="own">${h}<span>${t.roll}</span></button><p class="sr" aria-live="polite"></p>`, this.#r().setAttribute("initial", this.getAttribute("initial") ?? ""), this.#s();
		for (let e of this.root.querySelectorAll(".arrow")) e.addEventListener("click", () => this.#l(this.#n, Number(e.dataset.step)));
		for (let e of this.root.querySelectorAll(".tab")) e.addEventListener("click", () => {
			this.#n = Number(e.dataset.part);
			for (let t of this.root.querySelectorAll(".tab")) t.setAttribute("aria-pressed", String(t === e)), t.setAttribute("part", t === e ? "tab chosen" : "tab");
			this.#s();
		});
		this.root.querySelector(".dice").addEventListener("click", () => this.#u());
		for (let e of this.root.querySelectorAll(".arrow, .dice, .tab")) this.#d(e);
		let a = this.root.querySelector(".stage"), s = null;
		a.addEventListener("pointerdown", (e) => {
			s = {
				x: e.clientX,
				y: e.clientY
			}, a.setPointerCapture?.(e.pointerId);
		}), a.addEventListener("pointerup", (e) => {
			if (!s) return;
			let t = e.clientX - s.x, n = e.clientY - s.y;
			s = null, Math.abs(t) > 32 && Math.abs(t) > Math.abs(n) * 1.5 && this.#l(this.#n, t < 0 ? 1 : -1);
		}), a.addEventListener("pointercancel", () => s = null), this.#c();
	}
	#s() {
		let e = this.root.querySelector(".strip");
		if (!e) return;
		let t = o(this.theme, i())[this.#n], n = this.value[this.#n];
		e.innerHTML = `<span><span class="part">${t.name} · </span>${t.options[n]}</span><span class="dots">${t.options.map((e, t) => `<i class="${t === n ? "on" : ""}"></i>`).join("")}</span>`, this.#c();
	}
	#c() {
		let e = f[i()], t = o(this.theme, i())[this.#n]?.name ?? "";
		for (let n of this.root.querySelectorAll(".maker.tabs .arrow")) n.setAttribute("aria-label", e[n.dataset.step === "-1" ? "prev" : "next"].replace("{part}", t));
	}
	#l(e, t) {
		let n = [...this.value], r = s(this.theme)[e];
		n[e] = (n[e] + t + r) % r, this.#p(n), this.#f(t);
		let a = o(this.theme, i())[e];
		this.#m(`${a.name} · ${a.options[n[e]]}`);
	}
	#u() {
		if (this.#p(d(this.theme)), !a()) {
			let e = this.#r();
			e.classList.remove("hop");
			let t = this.root.querySelector(".dice");
			t.classList.remove("rolling"), requestAnimationFrame(() => {
				e.classList.add("hop"), t.classList.add("rolling");
			});
		}
		this.#m(f[i()].rolled);
	}
	#d(e) {
		let t = 0, n = 0, r = () => {
			clearTimeout(n), n = window.setTimeout(() => e.classList.remove("pressed"), Math.max(0, 120 - (performance.now() - t)));
		};
		e.addEventListener("pointerdown", () => {
			clearTimeout(n), t = performance.now(), e.classList.add("pressed");
		});
		for (let t of [
			"pointerup",
			"pointercancel",
			"pointerleave"
		]) e.addEventListener(t, r);
	}
	#f(e) {
		a() || this.#r().animate([
			{ transform: "none" },
			{ transform: `translateX(${e * 4}px) scale(1.04)` },
			{ transform: "none" }
		], {
			duration: 220,
			easing: "cubic-bezier(0.3, 1.4, 0.5, 1)"
		});
	}
	#p(e) {
		this.setAttribute("value", e.join(",")), this.emit("change", { value: e });
	}
	#m(e) {
		let t = this.root.querySelector(".sr");
		t.textContent = e;
		let n = this.root.querySelector(".tag");
		n && (n.textContent = e, n.classList.add("on"), clearTimeout(this.#t), this.#t = window.setTimeout(() => n.classList.remove("on"), 1100));
	}
};
n("ewo-emblem-maker", g);
//#endregion
export { g as EwoEmblemMaker };
