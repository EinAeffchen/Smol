import torch
from torchvision import models, transforms
from PIL import Image

from app.models import Media, Tag
from app.processors.base import MediaProcessor
from sqlmodel import select
from app.config import MEDIA_DIR, MODELS_DIR
from app.api.tags import create_tag, add_tag_to_media
from app.utils import logger


class ExifProcessor(MediaProcessor):
    name = "scene_tagger"
    model = None

    def load_model(self):
        self.model = models.resnet18(num_classes=365)
        self.model.load_state_dict(
            torch.load(MODELS_DIR / "resnet18_places365.pth.tar")["state_dict"]
        )
        self.model.eval()
        self.transform = transforms.Compose(
            [
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(
                    mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
                ),
            ]
        )
        self.classes = []
        with open(MODELS_DIR / "categories.txt") as class_file:
            for line in class_file:
                self.classes.append(line.strip().split(" ")[0][3:])
        self.classes = tuple(self.classes)

    def unload(self):
        del self.model

    def process(self, media: Media, session):
        # 1) skip if already extracted
        if session.exec(
            select(Media).where(Media.ran_auto_tagging.is_(True))
        ).first():
            return
        img = Image.open(MEDIA_DIR / media.path)
        input_tensor = self.transform(img).unsqueeze(0)
        logits = self.model(input_tensor)
        _, preds = torch.max(logits, 1)
        tag = self.classes[preds]
        tag_obj: Tag = create_tag(tag)
        add_tag_to_media(media.id, tag_obj.id)
        logger.debug("Added %s to %d", tag, media.id)

    def get_results(self, media_id: int, session):
        return session.exec(
            select(Tag).join(Tag.media).where(Media.id == media_id)
        ).first()
