import {
  calculateBurgerStackLayout,
} from "./burger-preview-layout";
import { describe, expect, it } from "vitest";

describe("burger preview height system", () => {
  it("no reserva altura para ingredientes con cantidad cero", () => {
    const layout =
      calculateBurgerStackLayout({
        hasSauce: false,
        meat: 1,
        cheese: 1,
        bacon: 0,
        caramelizedOnion: 0,
        whiteOnion: 0,
        pickles: 0,
        tomato: 0,
        lettuce: 0,
      });

    expect(layout.meatY).toBe(92);
    expect(layout.cheeseY).toBe(58);
    expect(layout.baconY).toBe(39);
    expect(
      layout.caramelizedOnionY,
    ).toBe(layout.baconY);
    expect(layout.whiteOnionY).toBe(
      layout.baconY,
    );
    expect(layout.picklesY).toBe(
      layout.baconY,
    );
    expect(layout.tomatoY).toBe(
      layout.baconY,
    );
    expect(layout.lettuceY).toBe(
      layout.baconY,
    );
  });

  it("hace crecer la hamburguesa según la cantidad real", () => {
    const single =
      calculateBurgerStackLayout({
        hasSauce: true,
        meat: 1,
        cheese: 1,
        bacon: 0,
        caramelizedOnion: 0,
        whiteOnion: 0,
        pickles: 0,
        tomato: 0,
        lettuce: 0,
      });

    const loaded =
      calculateBurgerStackLayout({
        hasSauce: true,
        meat: 5,
        cheese: 5,
        bacon: 5,
        caramelizedOnion: 1,
        whiteOnion: 5,
        pickles: 5,
        tomato: 5,
        lettuce: 5,
      });

    expect(
      loaded.stackHeight,
    ).toBeGreaterThan(
      single.stackHeight,
    );
    expect(loaded.topBunY).toBeLessThan(
      single.topBunY,
    );
  });

  it("mantiene el orden vertical acordado solo cuando hay ingredientes", () => {
    const layout =
      calculateBurgerStackLayout({
        hasSauce: true,
        meat: 2,
        cheese: 3,
        bacon: 2,
        caramelizedOnion: 1,
        whiteOnion: 2,
        pickles: 3,
        tomato: 2,
        lettuce: 2,
      });

    expect(layout.meatY).toBeGreaterThan(
      layout.cheeseY,
    );
    expect(
      layout.cheeseY,
    ).toBeGreaterThan(layout.baconY);
    expect(
      layout.baconY,
    ).toBeGreaterThan(
      layout.caramelizedOnionY,
    );
    expect(
      layout.caramelizedOnionY,
    ).toBeGreaterThan(
      layout.whiteOnionY,
    );
    expect(
      layout.whiteOnionY,
    ).toBeGreaterThan(
      layout.picklesY,
    );
    expect(
      layout.picklesY,
    ).toBeGreaterThan(
      layout.tomatoY,
    );
    expect(
      layout.tomatoY,
    ).toBeGreaterThan(
      layout.lettuceY,
    );
    expect(
      layout.lettuceY,
    ).toBeGreaterThan(
      layout.topBunY,
    );
  });

  it("mantiene el crecimiento de pepinillos compacto", () => {
    const one =
      calculateBurgerStackLayout({
        hasSauce: true,
        meat: 1,
        cheese: 1,
        bacon: 0,
        caramelizedOnion: 0,
        whiteOnion: 0,
        pickles: 1,
        tomato: 0,
        lettuce: 0,
      });

    const five =
      calculateBurgerStackLayout({
        hasSauce: true,
        meat: 1,
        cheese: 1,
        bacon: 0,
        caramelizedOnion: 0,
        whiteOnion: 0,
        pickles: 5,
        tomato: 0,
        lettuce: 0,
      });

    expect(
      one.picklesY - one.tomatoY,
    ).toBe(9);
    expect(
      five.picklesY - five.tomatoY,
    ).toBe(25);
  });

  it("compacta la carne cuando no hay salsa sin cambiar el resto de reglas", () => {
    const withSauce =
      calculateBurgerStackLayout({
        hasSauce: true,
        meat: 1,
        cheese: 1,
        bacon: 0,
        caramelizedOnion: 0,
        whiteOnion: 0,
        pickles: 0,
        tomato: 0,
        lettuce: 0,
      });

    const withoutSauce =
      calculateBurgerStackLayout({
        hasSauce: false,
        meat: 1,
        cheese: 1,
        bacon: 0,
        caramelizedOnion: 0,
        whiteOnion: 0,
        pickles: 0,
        tomato: 0,
        lettuce: 0,
      });

    expect(
      withoutSauce.meatY,
    ).toBeGreaterThan(
      withSauce.meatY,
    );
    expect(
      withoutSauce.stackHeight,
    ).toBe(withSauce.stackHeight);
  });
});
