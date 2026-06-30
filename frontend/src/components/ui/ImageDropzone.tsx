import { ChangeEvent, DragEvent, useRef, useState } from 'react';
import { ImagePlus, LoaderCircle, Trash2, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageDropzoneProps {
  value?: string | null;
  onUpload: (file: File) => Promise<void>;
  onRemove?: () => Promise<void>;
  label: string;
  description?: string;
  aspect?: 'square' | 'cover' | 'product';
  disabled?: boolean;
}

const ASPECTS = {
  square: 'aspect-square max-w-[180px]',
  cover: 'aspect-[16/6]',
  product: 'aspect-[4/3]',
};

export default function ImageDropzone({
  value,
  onUpload,
  onRemove,
  label,
  description = 'PNG, JPG ou WebP, 5 Mo maximum',
  aspect = 'product',
  disabled,
}: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(file?: File) {
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('Sélectionnez une image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('L’image dépasse 5 Mo.');
      return;
    }
    setBusy(true);
    try {
      await onUpload(file);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Upload impossible.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    void handleFile(event.target.files?.[0]);
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragging(false);
    void handleFile(event.dataTransfer.files?.[0]);
  }

  async function removeImage() {
    if (!onRemove) return;
    setBusy(true);
    setError('');
    try {
      await onRemove();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Suppression impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-1.5 text-[12px] font-semibold text-text-muted">{label}</div>
      <div className={cn('relative overflow-hidden rounded border bg-surface', ASPECTS[aspect], dragging ? 'border-primary ring-3 ring-primary-soft' : 'border-border-strong')}>
        {value ? (
          <>
            <img src={value} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy || disabled}
                className="grid h-9 w-9 place-items-center rounded bg-white text-text shadow-sm disabled:opacity-50"
                aria-label="Remplacer l’image"
                title="Remplacer l’image"
              >
                <ImagePlus size={16} />
              </button>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => void removeImage()}
                  disabled={busy || disabled}
                  className="grid h-9 w-9 place-items-center rounded bg-white text-danger shadow-sm disabled:opacity-50"
                  aria-label="Supprimer l’image"
                  title="Supprimer l’image"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragEnter={() => setDragging(true)}
            onDragLeave={() => setDragging(false)}
            onDragOver={event => event.preventDefault()}
            onDrop={onDrop}
            disabled={busy || disabled}
            className="flex h-full min-h-[132px] w-full flex-col items-center justify-center gap-2 p-5 text-center disabled:opacity-50"
          >
            {busy ? <LoaderCircle size={24} className="animate-spin text-primary" /> : <UploadCloud size={25} className="text-primary" />}
            <span className="text-[13px] font-semibold text-text">Déposer ou choisir une image</span>
            <span className="text-[11.5px] text-text-muted">{description}</span>
          </button>
        )}
        {busy && value && (
          <div className="absolute inset-0 grid place-items-center bg-black/35">
            <LoaderCircle size={26} className="animate-spin text-white" />
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onInputChange} className="hidden" />
      {error && <div className="mt-1.5 text-[11.5px] text-danger">{error}</div>}
    </div>
  );
}
