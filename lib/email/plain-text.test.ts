import { describe, expect, it } from "vitest";
import { decodeEntities, htmlToText, linkText } from "./plain-text";

describe("decodeEntities", () => {
  it("decodes named and numeric references, and turns nbsp into a space", () => {
    expect(decodeEntities("a&nbsp;b &amp; c&#8217;s &#x2014; &lt;tag&gt;")).toBe("a b & c’s — <tag>");
    expect(decodeEntities("&#160;")).toBe(" ");
  });

  it("leaves unknown or invalid references alone", () => {
    expect(decodeEntities("&bogus; &#0; &#x110000;")).toBe("&bogus; &#0; &#x110000;");
  });
});

describe("linkText", () => {
  it("shows the label and the URL, or one when they say the same thing", () => {
    expect(linkText("Sign up", "https://a.com")).toBe("Sign up (https://a.com)");
    expect(linkText("https://a.com", "https://a.com")).toBe("https://a.com");
    expect(linkText("hi@a.com", "mailto:hi@a.com")).toBe("mailto:hi@a.com");
    expect(linkText("", "https://a.com")).toBe("https://a.com");
    expect(linkText("Label", "")).toBe("Label");
  });
});

describe("htmlToText", () => {
  it("keeps link URLs", () => {
    expect(htmlToText('<p>Read <a href="https://a.com/x">the post</a> now.</p>')).toBe(
      "Read the post (https://a.com/x) now.",
    );
  });

  it("drops unsafe and fragment-only link targets but keeps the text", () => {
    expect(htmlToText('<p><a href="javascript:alert(1)">x</a> <a href="#top">top</a></p>')).toBe("x top");
  });

  it("gives bare-domain links a scheme", () => {
    expect(htmlToText('<a href="example.com">here</a>')).toBe("here (https://example.com)");
  });

  it("separates paragraphs with a blank line and keeps <br> as a line break", () => {
    expect(htmlToText("<p>One</p><p>Two<br>Three</p>")).toBe("One\n\nTwo\nThree");
  });

  it("decodes entities, including &nbsp;", () => {
    expect(htmlToText("<p>Fish&nbsp;&amp;&nbsp;chips</p>")).toBe("Fish & chips");
  });

  it("renders bullet and numbered lists, including TipTap's <li><p>", () => {
    expect(htmlToText("<p>Intro</p><ul><li><p>One</p></li><li><p>Two</p></li></ul><p>Outro</p>")).toBe(
      "Intro\n\n- One\n- Two\n\nOutro",
    );
    expect(htmlToText("<ol><li>First</li><li>Second</li></ol>")).toBe("1. First\n2. Second");
  });

  it("indents nested lists", () => {
    expect(htmlToText("<ul><li>A<ul><li>A1</li></ul></li><li>B</li></ul>")).toBe("- A\n  - A1\n- B");
  });

  it("collapses source whitespace and never stacks more than one blank line", () => {
    expect(htmlToText("<div>\n  <p>  a   b  </p>\n\n\n<div><p>c</p></div></div>")).toBe("a b\n\nc");
  });

  it("drops <style> and <script> content and comments", () => {
    expect(htmlToText("<style>p{color:red}</style><!-- x --><p>ok</p><script>bad()</script>")).toBe("ok");
  });

  it("returns an empty string for empty input", () => {
    expect(htmlToText("")).toBe("");
  });
});
