<script lang="ts">
  interface Props {
    value: string;
    onchange: (value: string) => void;
    placeholder?: string;
    class?: string;
  }
  const { value, onchange, placeholder, class: className = '' }: Props = $props();
</script>

<input
  type="datetime-local"
  {value}
  oninput={(e) => onchange(e.currentTarget.value)}
  {placeholder}
  class="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark] {className}"
/>
