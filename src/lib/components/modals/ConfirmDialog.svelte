<script lang="ts">
  import Dialog from './Dialog.svelte';

  interface Props {
    title: string;
    message: string;
    confirmLabel?: string;
    destructive?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }

  const { title, message, confirmLabel = 'Delete', destructive = true, onConfirm, onCancel }: Props = $props();
</script>

<Dialog
  variant="confirm"
  {title}
  {message}
  {confirmLabel}
  {destructive}
  onConfirm={() => onConfirm()}
  {onCancel}
/>
