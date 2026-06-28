import { useState } from "react";

type Props = {
  initialValue: string;
  onSave: (
    value: string
  ) => Promise<void>;
};

export default function useRenameState({
  initialValue,
  onSave,
}: Props) {
  const [value, setValue] =
    useState(initialValue);

  const [editing, setEditing] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  // Keep the editable value in sync when the source name changes,
  // adjusting state during render instead of in an effect.
  const [lastInitial, setLastInitial] =
    useState(initialValue);

  if (initialValue !== lastInitial) {
    setLastInitial(initialValue);
    setValue(initialValue);
  }

  async function save() {
    if (saving) {
      return;
    }

    const nextValue =
      value.trim();

    if (!nextValue) {
      cancel();
      return;
    }

    if (
      nextValue === initialValue
    ) {
      setEditing(false);
      return;
    }

    try {
      setSaving(true);

      await onSave(nextValue);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  function start() {
    setEditing(true);
  }

  function cancel() {
    setValue(initialValue);
    setEditing(false);
  }

  return {
    value,

    editing,

    saving,

    setValue,

    start,

    cancel,

    save,
  };
}