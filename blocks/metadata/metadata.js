export default function decorate(block) {
  (block.closest('.metadata-wrapper') || block.parentElement).hidden = true;
}
