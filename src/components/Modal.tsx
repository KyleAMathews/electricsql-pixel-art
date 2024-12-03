import React from 'react';
import {
  Button,
  Dialog,
  Heading,
  Modal as AriaModal,
  ModalOverlay
} from 'react-aria-components';
import type { ReactNode } from 'react';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={open => !open && onClose()}
      isDismissable
      className="modal-overlay"
    >
      <AriaModal className="modal-content">
        <Dialog className="modal-dialog">
          <Heading slot="title" className="modal-title">
            {title}
          </Heading>
          <div className="modal-body">
            {children}
          </div>
          <Button
            slot="close"
            className="modal-close"
            onPress={onClose}
          >
            ×
          </Button>
        </Dialog>
      </AriaModal>
    </ModalOverlay>
  );
}
