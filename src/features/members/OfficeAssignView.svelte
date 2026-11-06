<script lang="ts">
  import { bus, directory, session } from '../../lib/container';
  import { TOAST } from '../../channels';
  import { Action } from '../../lib/state/Action.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import DateInput from '../../ui/DateInput.svelte';
  import Detail from '../../ui/Detail.svelte';
  import EditorForm from '../../ui/EditorForm.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import { OFFICES_CHANGED } from './events';
  import type { OfficeKind } from './MembersApi';
  import { boardSettings, membersApi } from './services';

  /** Gives an eligible member a function (Vorstand, auditor, club offices). Offices have no window of their own, so it closes. */
  let { handle }: { id: string; handle: WindowHandle } = $props();

  // svelte-ignore state_referenced_locally
  handle.setTitle('Funktion vergeben');
  const today = session.clock.today();
  const candidates = new Resource(() => directory.allMembers());
  void candidates.load();
  const officeOptions = $derived(boardSettings.enabled.map((kind) => ({ value: kind, label: boardSettings.label(kind) })));
  /** server: MembershipRules.eligible — only members whose membership allows an office. */
  const memberOptions = $derived(
    (candidates.value ?? []).filter((m) => m.eligible).map((m) => ({ value: m.id, label: `${m.lastName}, ${m.firstName}` })),
  );

  let memberId = $state('');
  let office = $state<OfficeKind | ''>('');
  let startsOn = $state(today);
  let termEndsOn = $state('');
  let coopted = $state(false);
  /** server: MembershipHandlers.assign — elected for a later date, entered up to a year ahead. */
  const latestStart = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;
  const termYears = $derived(office ? (boardSettings.get(office)?.termYears ?? 3) : null);
  const check = $state({
    submitted: false,
    get valid() {
      return !!memberId && !!office;
    },
  });
  const save = new Action();

  async function submit() {
    if (!office) return;
    const assigned = await save.attempt(() =>
      membersApi.assignOffice({ memberId, office: office as OfficeKind, startsOn, termEndsOn: termEndsOn || null, coopted }),
    );
    if (!assigned) return;
    bus.publish(TOAST, { text: `${boardSettings.label(assigned.office)}: ${assigned.name}.` });
    bus.publish(OFFICES_CHANGED);
    if (assigned.memberId === session.member.id) await session.loadMe();
    handle.close();
  }
</script>

<Detail title="Funktion vergeben">
  <EditorForm action={save} submitLabel="Funktion vergeben" validate={check} oncancel={() => handle.close()} onsubmit={submit}>
    <div class="grid-2">
      <Field
        label="Mitglied"
        hint={candidates.value && !memberOptions.length
          ? 'Noch niemand ist wählbar: zuerst Mitglieder einladen und ihnen eine Mitgliedsart mit Wählbarkeit geben.'
          : 'Nur wählbare Mitglieder (Einstellungen › Mitgliedschaft).'}
        error={check.submitted && !memberId ? 'Bitte ein Mitglied wählen.' : null}
      >
        <Select bind:value={memberId} placeholder="Bitte wählen" options={memberOptions} />
      </Field>
      <Field label="Funktion" error={check.submitted && !office ? 'Bitte eine Funktion wählen.' : null}>
        <Select bind:value={office} placeholder="Bitte wählen" options={officeOptions} />
      </Field>
      <Field label="Beginn">
        <DateInput bind:value={startsOn} max={latestStart} required />
      </Field>
      <Field
        label="Ende der Funktionsperiode (optional)"
        hint={termYears ? `Leer = ${termYears === 1 ? 'ein Jahr' : `${termYears} Jahre`} nach Beginn.` : 'Leer = Funktionsperiode der Funktion.'}
      >
        <DateInput bind:value={termEndsOn} min={startsOn} />
      </Field>
    </div>
    <label class="check"><input type="checkbox" bind:checked={coopted} /> Kooptiert, bis die nächste Mitgliederversammlung bestätigt</label>
  </EditorForm>
</Detail>
