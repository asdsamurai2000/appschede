import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { useNavigation } from "expo-router";

type Options = {
  onSave?: () => Promise<void> | void;
  saveLabel?: string;
  discardLabel?: string;
  cancelLabel?: string;
  title?: string;
  message?: string;
};

/**
 * Intercetta la navigazione indietro se ci sono modifiche non salvate
 * e mostra un Alert con opzioni: Salva / Esci senza salvare / Annulla.
 */
export function useUnsavedChangesWarning(dirty: boolean, options: Options = {}) {
  const navigation = useNavigation();
  const skipRef = useRef(false);
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", (e: any) => {
      if (!dirty || skipRef.current) return;
      e.preventDefault();
      const o = optsRef.current;
      const buttons: any[] = [
        { text: o.cancelLabel ?? "Annulla", style: "cancel", onPress: () => {} },
        {
          text: o.discardLabel ?? "Esci senza salvare",
          style: "destructive",
          onPress: () => {
            skipRef.current = true;
            navigation.dispatch(e.data.action);
          },
        },
      ];
      if (o.onSave) {
        buttons.push({
          text: o.saveLabel ?? "Salva",
          onPress: async () => {
            try { await o.onSave?.(); } catch {}
            skipRef.current = true;
            navigation.dispatch(e.data.action);
          },
        });
      }
      Alert.alert(
        o.title ?? "Modifiche non salvate",
        o.message ?? "Vuoi salvare le modifiche prima di uscire?",
        buttons,
      );
    });
    return unsub;
  }, [dirty, navigation]);

  return {
    /** Chiamare prima di navigare via da codice dopo un salvataggio riuscito. */
    markSaved: () => { skipRef.current = true; },
  };
}
