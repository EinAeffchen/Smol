import React, { Suspense, useState } from 'react';
import { Box, Tabs, Tab, CircularProgress } from '@mui/material';

import { TagsSection } from './TagsSection';
import SimilarContent from './MediaRelatedContent';
import { MediaExif } from './MediaExif';
import { MediaDetail } from '../types';
import { Media } from '../types';
import { ENABLE_PEOPLE } from '../config';
import { PeopleTabContent } from './PeopleTabContent';
import TagIcon from '@mui/icons-material/Tag';
import PeopleIcon from '@mui/icons-material/People';
import CollectionsIcon from '@mui/icons-material/Collections';
import DataObjectIcon from '@mui/icons-material/DataObject';
interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div role="tabpanel" hidden={value !== index} {...other}>
            {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
        </div>
    );
}

interface MediaContentTabsProps {
    detail: MediaDetail;
    onTagUpdate: (updatedMedia: Media) => void;
    onDetailReload: () => void;
}

export function MediaContentTabs(props: MediaContentTabsProps) {
    const {
        detail,
        onTagUpdate,
        onDetailReload,
    } = props;

    const [tabValue, setTabValue] = useState(0);
    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => setTabValue(newValue);
    const { media, persons, orphans } = detail;

    const renderTab = (label: string, icon: React.ReactNode) => (
        <Tab
            label={label}
            icon={icon}
            iconPosition="start"
            sx={{ minHeight: '64px' }} // Taller tabs for a better look
        />
    )
    const tabIndices = {
        similar: 0,
        people: ENABLE_PEOPLE ? 1 : -1, // -1 if not rendered
        tags: ENABLE_PEOPLE ? 2 : 1,
        exif: ENABLE_PEOPLE ? 3 : 2,
    };

    return (
        <Box sx={{ width: '100%', mt: 4 }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={tabValue} onChange={handleTabChange} aria-label="Media content tabs" variant="scrollable" scrollButtons="auto">
                    {renderTab("Similar", <CollectionsIcon />)}
                    {ENABLE_PEOPLE && renderTab(`People (${persons.length})`, <PeopleIcon />)}
                    {renderTab("Tags", <TagIcon />)}
                    {renderTab("Exif Data", <DataObjectIcon />)}
                </Tabs>
            </Box>

            <TabPanel value={tabValue} index={tabIndices.similar}>
                <Suspense fallback={<CircularProgress />}>
                    <SimilarContent mediaId={media.id} />
                </Suspense>
            </TabPanel>
            {ENABLE_PEOPLE && (
                <TabPanel value={tabValue} index={tabIndices.people}>
                    {/* The People tab now uses its own smart component */}
                    <PeopleTabContent
                        initialPersons={persons}
                        initialOrphans={orphans}
                        onDataChanged={onDetailReload}
                    />
                </TabPanel>
            )}
            <TabPanel value={tabValue} index={tabIndices.tags}>
                <TagsSection
                    media={media}
                    onTagAdded={onDetailReload}
                    onUpdate={onTagUpdate}
                />
            </TabPanel>

            <TabPanel value={tabValue} index={tabIndices.exif}>
                <MediaExif show={true} mediaId={media.id} />
            </TabPanel>
        </Box>
    );
}