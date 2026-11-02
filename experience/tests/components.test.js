import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { destinations } from "../src/router/index.js";
import DriverCard from "../src/components/drivers/DriverCard.vue";
import ConstructorCard from "../src/components/teams/ConstructorCard.vue";
import ChampionCard from "../src/components/champions/ChampionCard.vue";
import RaceCard from "../src/components/calendar/RaceCard.vue";
import DataState from "../src/components/common/DataState.vue";
import Portrait from "../src/components/common/Portrait.vue";
import ComparisonPanel from "../src/components/drivers/ComparisonPanel.vue";
import ResultsTable from "../src/components/common/ResultsTable.vue";
import { CHAMPIONS_HISTORY } from "../../assets/js/champion-history.js";
import { decodeResponse } from "../../assets/js/data-model.js";
import { driversFrom, constructorsFrom } from "../src/adapters/portal.js";
import recording from "./fixtures/jolpica-recording.json";
const router = createRouter({
  history: createMemoryHistory(),
  routes: destinations,
});
const ds = decodeResponse(
  recording.responses["2026/driverStandings.json?limit=100"],
  "driver-standings",
  2026,
);
const cs = decodeResponse(
  recording.responses["2026/constructorStandings.json?limit=100"],
  "constructor-standings",
  2026,
);
const drivers = driversFrom(ds);
const options = (props) => ({ props, global: { plugins: [router] } });
describe("interactive cards and accessible data states", () => {
  it("uses a small variant of the same verified asset for dashboard avatars", () => {
    const src =
      "https://media.formula1.com/image/upload/c_fill,w_720/q_auto/same-driver.webp";
    const w = mount(Portrait, {
      props: { src, name: "Driver", compact: true },
    });
    expect(w.get("img").attributes("src")).toBe(src.replace("w_720", "w_96"));
  });
  it("keeps all seven primary destinations and lazy route components", () => {
    expect(destinations).toHaveLength(7);
    expect(destinations.every((d) => typeof d.component === "function")).toBe(
      true,
    );
    expect(destinations.map((d) => d.path)).toContain("/race-center");
  });
  it("driver card emits selection and describes its pressed state", async () => {
    const w = mount(
      DriverCard,
      options({ driver: drivers[0], selected: false }),
    );
    const b = w.get("button");
    expect(b.attributes("aria-pressed")).toBe("false");
    await b.trigger("click");
    expect(w.emitted("compare")).toEqual([[drivers[0].id]]);
    await w.setProps({ selected: true });
    expect(b.attributes("aria-pressed")).toBe("true");
  });
  it("driver details use native keyboard disclosure and season labels", () => {
    const w = mount(DriverCard, options({ driver: drivers[0] }));
    expect(w.find("details summary").exists()).toBe(true);
    expect(w.text()).toContain("2026");
    expect(w.text()).toContain("Pole positions: não disponíveis");
  });
  it("API strings are interpolated as text, never injected markup", () => {
    const w = mount(
      DriverCard,
      options({
        driver: { ...drivers[0], fullName: "<img src=x onerror=alert(1)>" },
      }),
    );
    expect(w.find("h2 img").exists()).toBe(false);
    expect(w.get("h2").text()).toContain("<img");
  });
  it("constructor card links all season participants with historical scope", () => {
    const w = mount(
      ConstructorCard,
      options({ team: constructorsFrom(cs, ds)[0] }),
    );
    expect(w.findAll(".participant-list a")).toHaveLength(2);
    expect(w.text()).toContain("não confirma a escalação atual");
    expect(w.text()).toContain("até 2025");
  });
  it("champion card retains author, source, license and complete title years", () => {
    const c = CHAMPIONS_HISTORY.find((c) => c.id === "hamilton");
    const w = mount(ChampionCard, options({ champion: c }));
    expect(w.text()).toContain(c.photoCredit.attribution);
    expect(w.find(`a[href="${c.photoCredit.licenseUrl}"]`).exists()).toBe(true);
    for (const y of c.titleYears) expect(w.text()).toContain(String(y));
  });
  it("all 35 champion cards preserve their source and licensing links", () => {
    for (const c of CHAMPIONS_HISTORY) {
      const w = mount(ChampionCard, options({ champion: c }));
      expect(w.findAll("a")).toHaveLength(3);
      w.unmount();
    }
  });
  it("race card keeps explicit unknown status and routes to its actual round", () => {
    const race =
      recording.responses["current/races.json?limit=100"].MRData.RaceTable
        .Races[0];
    const w = mount(
      RaceCard,
      options({ race: { ...race, status: "result_pending" } }),
    );
    expect(w.text()).toContain("Aguardando resultado");
    expect(w.get("a").attributes("href")).toContain("round=1");
  });
  it("loading state has a screen reader status", () => {
    const w = mount(DataState, {
      props: { resource: { status: "loading" }, label: "pilotos" },
    });
    expect(w.get('[role="status"]').text()).toContain("Carregando pilotos");
  });
  it("empty data state is distinct from provider failure", () => {
    const w = mount(DataState, { props: { resource: { status: "empty" } } });
    expect(w.text()).toContain("Nenhum registro");
    expect(w.find("button").exists()).toBe(false);
  });
  it("retry emits an action from the error state", async () => {
    const w = mount(DataState, {
      props: { resource: { status: "error", error: "Fonte indisponível" } },
    });
    await w.get("button").trigger("click");
    expect(w.emitted("retry")).toHaveLength(1);
  });
  it("ready data state renders its content", () => {
    const w = mount(DataState, {
      props: { resource: { status: "ready" } },
      slots: { default: "<p>Conteúdo validado</p>" },
    });
    expect(w.text()).toBe("Conteúdo validado");
  });
  it("image errors switch once to a local fallback with descriptive text", async () => {
    const w = mount(Portrait, {
      props: { src: "https://media.formula1.com/a.webp", name: "Piloto" },
    });
    await w.get("img").trigger("error");
    expect(w.get("img").attributes("src")).toContain("placeholder-driver.svg");
    expect(w.get("img").attributes("alt")).toContain("indisponível");
  });
  it("comparison requires two distinct same-season drivers", () => {
    const w = mount(ComparisonPanel, {
      props: { a: drivers[0], b: drivers[0] },
    });
    expect(w.text()).toContain("Selecione dois pilotos diferentes");
    expect(w.find("figure").exists()).toBe(false);
  });
  it("comparison charts have labels and a semantic table alternative", () => {
    const w = mount(ComparisonPanel, {
      props: { a: drivers[0], b: drivers[1] },
    });
    expect(w.findAll("figure figcaption")).toHaveLength(4);
    expect(w.findAll("table tbody tr")).toHaveLength(4);
    expect(w.text()).toContain("arquivo até 2025");
  });
  it("results table retains caption and row/column headers", () => {
    const w = mount(ResultsTable, {
      props: {
        rows: [
          {
            id: "x",
            position: 1,
            name: "Piloto",
            team: "Equipe",
            points: null,
            laps: null,
            time: "Não disponível",
          },
        ],
        season: 2026,
        name: "Corrida",
      },
    });
    expect(w.get("caption").text()).toContain("2026");
    expect(w.get("tbody th").attributes("scope")).toBe("row");
    expect(w.findAll('thead th[scope="col"]')).toHaveLength(6);
    expect(w.text()).toContain("Não disponível");
  });
});
