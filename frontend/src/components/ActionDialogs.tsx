import React from 'react';
import { Dialog, DialogTitle, DialogActions, Button } from '@mui/material';

const ERROR = 'error';

interface ActionDialogsProps {
    dialogType: 'convert' | 'deleteRecord' | 'deleteFile' | null;
    onClose: () => void;
    onConfirmConvert: () => void;
    onConfirmDeleteRecord: () => void;
    onConfirmDeleteFile: () => void;
}

export function ActionDialogs({
    dialogType,
    onClose,
    onConfirmConvert,
    onConfirmDeleteRecord,
    onConfirmDeleteFile,
}: ActionDialogsProps) {
    return (
        <>
            {/* Convert Dialog */}
            <Dialog open={dialogType === 'convert'} onClose={onClose}>
                <DialogTitle>Convert Video Format?</DialogTitle>
                <DialogActions>
                    <Button onClick={onClose} sx={{ color: "white" }}>Cancel</Button>
                    <Button variant="contained" onClick={onConfirmConvert}>Confirm</Button>
                </DialogActions>
            </Dialog>

            {/* Delete Record Dialog */}
            <Dialog open={dialogType === 'deleteRecord'} onClose={onClose}>
                <DialogTitle>Delete Database Record?</DialogTitle>
                <DialogActions>
                    <Button onClick={onClose} sx={{ color: "white" }}>Cancel</Button>
                    <Button variant="contained" color={ERROR} onClick={onConfirmDeleteRecord}>Delete</Button>
                </DialogActions>
            </Dialog>

            {/* Delete File Dialog */}
            <Dialog open={dialogType === 'deleteFile'} onClose={onClose}>
                <DialogTitle>Delete File from Disk?</DialogTitle>
                <DialogActions>
                    <Button onClick={onClose} sx={{ color: "white" }}>Cancel</Button>
                    <Button variant="contained" color={ERROR} onClick={onConfirmDeleteFile}>Delete</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}