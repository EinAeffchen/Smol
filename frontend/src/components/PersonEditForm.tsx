import React, { useState } from 'react'
import {
    Box,
    Button,
    FormControl,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    TextField,
} from '@mui/material'
import { READ_ONLY } from '../config'

export function PersonEditForm({ initialPersonData, onSave, saving }) {
    const [form, setForm] = useState(initialPersonData);

    React.useEffect(() => {
        setForm(initialPersonData);
    }, [initialPersonData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
        const target = e.target as HTMLInputElement;
        const { name, value } = target;
        const type = target.type;

        setForm(prevForm => ({
            ...prevForm,
            [name!]: type === 'number' ? (value === '' ? '' : parseFloat(value)) : value
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(form);
    };

    return (
        <Box component="form" onSubmit={handleSubmit} sx={{ flex: 1 }}>
            <Grid container spacing={2} alignItems="flex-end">
                <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                        fullWidth
                        label="Name"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                        fullWidth
                        label="Age"
                        name="age"
                        type="number"
                        value={form.age}
                        onChange={handleChange}
                        slotProps={{
                            inputLabel: {
                                shrink: form.age !== '' && form.age !== undefined && form.age !== null && form.age.toString().length > 0
                            }
                        }}
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <FormControl fullWidth>
                        <InputLabel>Gender</InputLabel>
                        <Select
                            name="gender"
                            value={form.gender}
                            onChange={handleChange as any}
                            label="Gender"
                        >
                            <MenuItem value="">— select —</MenuItem>
                            <MenuItem value="male">Male</MenuItem>
                            <MenuItem value="female">Female</MenuItem>
                            <MenuItem value="other">Other</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                {!READ_ONLY && (
                    <Grid size={{ xs: 12, md: 3 }}>
                        <Button fullWidth type="submit" variant="contained" color="primary" disabled={saving} size="large" sx={{ height: '56px' }}>
                            {saving ? 'Saving…' : 'Save'}
                        </Button>
                    </Grid>
                )}
            </Grid>
        </Box>
    );
}