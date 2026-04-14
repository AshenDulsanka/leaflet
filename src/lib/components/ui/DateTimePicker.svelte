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
  class="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-primary hover:border-border/80 [color-scheme:dark] {className}"
/>
