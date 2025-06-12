import React, { useState, useEffect } from 'react';
import {
    Box,
    Button,
    FormControl,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    CircularProgress, // ADDED: For the saving indicator
} from '@mui/material';
import { READ_ONLY } from '../config';

export function PersonEditForm({ initialPersonData, onSave, saving }: {
    initialPersonData: { name: string; age: string; gender: string };
    onSave: (form: any) => void;
    saving: boolean;
}) {
    const [form, setForm] = useState(initialPersonData);

    useEffect(() => {
        setForm(initialPersonData);
    }, [initialPersonData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
        const target = e.target as HTMLInputElement;
        const { name, value } = target;
        setForm(prevForm => ({ ...prevForm, [name!]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(form);
    };

    // This component is now self-contained and doesn't render if in READ_ONLY mode
    if (READ_ONLY) {
        return null;
    }

    return (
        <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            {/* The Grid now centers items vertically for a cleaner alignment with the button */}
            <Grid container spacing={2} alignItems="center">

                {/* A Grid item to act as a container for all the input fields */}
                <Grid size={{ xs: 12 }} md>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6, md: 5 }}>
                            <TextField
                                fullWidth
                                label="Name"
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                variant="filled" // CHANGED: For a sleeker look
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 3, md: 3 }}>
                            <TextField
                                fullWidth
                                label="Age"
                                name="age"
                                type="number"
                                value={form.age}
                                onChange={handleChange}
                                variant="filled" // CHANGED
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 3, md: 4 }}>
                            <FormControl fullWidth variant="filled"> {/* CHANGED */}
                                <InputLabel>Gender</InputLabel>
                                <Select
                                    name="gender"
                                    value={form.gender}
                                    onChange={handleChange as any}
                                    label="Gender"
                                >
                                    <MenuItem value=""><em>— select —</em></MenuItem>
                                    <MenuItem value="male">Male</MenuItem>
                                    <MenuItem value="female">Female</MenuItem>
                                    <MenuItem value="other">Other</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </Grid>

                {/* A separate Grid item for the button, aligned to the end */}
                <Grid size={{ xs: 12 }} md="auto">
                    <Button
                        fullWidth
                        type="submit"
                        variant="contained"
                        color="primary"
                        disabled={saving}
                        sx={{ height: '56px' }} // Matches the height of filled inputs
                    >
                        {/* CHANGED: Shows a spinner while saving for better UX */}
                        {saving ? <CircularProgress size={24} color="inherit" /> : 'Save'}
                    </Button>
                </Grid>

            </Grid>
        </Box>
    );
}