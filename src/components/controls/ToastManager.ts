export interface ToastOptions {
  title: string;
  subtitle?: string;
  previewUrl?: string;
  duration?: number;
}

export class ToastManager {
  private container: HTMLDivElement;
  private activeToast: HTMLElement | null = null;

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'app-toast-container';
    parent.appendChild(this.container);
  }

  showToast(options: ToastOptions): void {
    if (this.activeToast) {
      this.activeToast.remove();
      this.activeToast = null;
    }

    const toast = document.createElement('div');
    toast.className = 'app-toast';
    const preview = options.previewUrl
      ? `
        <div class="app-toast-preview">
          <img src="${options.previewUrl}" alt="Toast preview" />
        </div>
      `
      : '';

    const subtitle = options.subtitle
      ? `<div class="app-toast-subtitle">${options.subtitle}</div>`
      : '';

    toast.innerHTML = `
      ${preview}
      <div class="app-toast-body">
        <div class="app-toast-title">${options.title}</div>
        ${subtitle}
      </div>
    `;

    this.container.appendChild(toast);
    this.activeToast = toast;

    requestAnimationFrame(() => {
      toast.classList.add('is-visible');
    });

    const dismiss = () => {
      toast.classList.remove('is-visible');
      toast.classList.add('is-hiding');
      toast.addEventListener(
        'transitionend',
        () => {
          toast.remove();
          if (this.activeToast === toast) {
            this.activeToast = null;
          }
        },
        { once: true }
      );
    };

    toast.addEventListener('click', dismiss);
    setTimeout(dismiss, options.duration ?? 2600);
  }

  showCopyToast(imageUrl: string): void {
    this.showToast({
      title: 'Copied to clipboard',
      subtitle: 'Image ready to paste',
      previewUrl: imageUrl
    });
  }
}
