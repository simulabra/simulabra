import base from './base.js';
import html from './html.js';
import llm from './llm.js';

export default await base.find('class', 'module').new({
  name: 'bootstrap',
  imports: [base, html, llm],
  async on_load(_, $) {
    const __ = globalThis.SIMULABRA;
    const $el = $.html_element.proxy();

    // DEAR BOOTSTRAP WRITES THE REST OF YOUR CODE
    // chat ui
    // - input text
    // - streaming assistant response
    // - links to code locations
    // diff view
    // - do you accept?
    // - standard format communicated via prompt
    // command syntax + examples
    // - short and memorable for icl
    // - how agent gets additional context
    // system prompt(s)
    // - thanks to prompt caching we can waste some tokens
    // - teach basics of Simulabra in 1500 tokens
    // very basic editor
    // - codemirror should suffice
    // - looming completion
    // load/save files
    // - to disk
    // - file picker

}).load();
