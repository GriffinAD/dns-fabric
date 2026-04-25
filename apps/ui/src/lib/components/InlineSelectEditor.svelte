<script lang="ts">
  import type { BaseDataTableSelectOption } from "./baseDataTable";

  let {
    value,
    options,
    placeholder,
    invalid = false,
    describedBy = undefined,
    onValueChange,
  }: {
    value: string;
    options?: BaseDataTableSelectOption[];
    placeholder?: string;
    invalid?: boolean;
    describedBy?: string;
    onValueChange: (next: string) => void;
  } = $props();
</script>

<!-- c8 ignore next -->
<select
  class="w-full min-w-[8rem] rounded border border-gray-300 bg-white px-2 py-1 text-sm leading-5 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
  {value}
  onchange={(e) => onValueChange((e.currentTarget as HTMLSelectElement).value)}
  aria-invalid={invalid ? "true" : "false"}
  aria-describedby={describedBy}
>
  {#if placeholder}
    <option value="">{placeholder}</option>
  {/if}
  {#each options ?? [] as opt (opt.value)}
    <option value={opt.value} disabled={opt.disabled}>{opt.label}</option>
  {/each}
</select>
