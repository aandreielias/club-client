import type { EventBus } from '../../lib/bus';
import { APP_ERROR, CONFIRM, TOAST } from '../../channels';
import type { ActionRule, ResolutionAction, StatutesPlace } from './model';
import { withRule } from './ResolutionRuleForm.svelte';
import { meetingsApi, resolutionRules } from './services';

/**
 * Saves one decision's rule into the club's current rules (others as the server has them now), with `statutes` when given; the store
 * takes the answer.
 */
export async function saveRule(rule: ActionRule, statutes: StatutesPlace | null = null) {
  const rules = withRule(await meetingsApi.resolutionRules(), rule);
  const saved = await meetingsApi.saveResolutionRules(statutes ? { ...rules, statutes } : rules);
  resolutionRules.value = saved;
  return saved;
}

/**
 * Removes a decision from every meeting type at once (after asking) or offers it again; passed resolutions keep it. Answers whether
 * it changed.
 */
export async function setRuleEnabled(bus: EventBus, action: ResolutionAction, enabled: boolean): Promise<boolean> {
  const rule = resolutionRules.get(action);
  if (!rule) return false;
  const label = resolutionRules.label(action);
  if (
    !enabled &&
    !(await bus.request(CONFIRM, {
      title: 'Beschlussart entfernen',
      confirmLabel: 'Entfernen',
      danger: true,
      message: `„${label}“ wird aus allen Sitzungsarten genommen und ist für neue Beschlüsse nicht mehr wählbar. Gefasste Beschlüsse bleiben.`,
    }))
  )
    return false;
  try {
    await saveRule({ ...rule, enabled });
    bus.publish(TOAST, { text: enabled ? `${label} wiederhergestellt. In den Sitzungsarten wieder auswählen.` : `${label} entfernt.` });
    return true;
  } catch (error) {
    bus.publish(APP_ERROR, error);
    return false;
  }
}
