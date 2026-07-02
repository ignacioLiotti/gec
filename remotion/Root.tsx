import { Composition, Folder } from "remotion";
import { SintesisCommercial } from "./SintesisCommercial";

export const RemotionRoot = () => {
	return (
		<Folder name="Commercial">
			<Composition
				id="SintesisCommercial"
				component={SintesisCommercial}
				durationInFrames={90 * 30}
				fps={30}
				width={1920}
				height={1080}
			/>
		</Folder>
	);
};
